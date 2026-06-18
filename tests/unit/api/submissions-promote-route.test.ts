/**
 * Tests fuer `POST /api/submissions/[id]/promote` (ADR-0004 §E3, W5).
 * Nur Reviewer (owner/co-creator); nur aus `ready`; ready->publishing->published.
 * Token-/Speicher-Fehler -> Ruecksprung auf `ready` (503, retry-bar). Idempotent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getPreferredUserEmail: vi.fn(),
  isCoCreatorOrOwner: vi.fn(),
  getSubmissionById: vi.fn(),
  changeSubmissionStatus: vi.fn(),
  getServerProvider: vi.fn(),
  getInboxProvider: vi.fn(),
  upsertMarkdown: vi.fn(),
  promoteSubmission: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }));
vi.mock('@/lib/auth/user-email', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/auth/user-email')>()),
  getPreferredUserEmail: h.getPreferredUserEmail,
}));
vi.mock('@/lib/repositories/library-members-repo', () => ({ isCoCreatorOrOwner: h.isCoCreatorOrOwner }));
vi.mock('@/lib/repositories/wizard-submissions-repo', () => ({
  getSubmissionById: h.getSubmissionById,
  changeSubmissionStatus: h.changeSubmissionStatus,
}));
vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: h.getServerProvider }));
vi.mock('@/lib/storage/inbox/inbox-provider-entry', () => ({ getInboxProvider: h.getInboxProvider }));
vi.mock('@/lib/chat/ingestion-service', () => ({ IngestionService: { upsertMarkdown: h.upsertMarkdown } }));
vi.mock('@/lib/submissions/promotion', () => ({ promoteSubmission: h.promoteSubmission }));
// Schwer-Imports von promote-actions (transcript-Shadow-Twin). Werden hier nie
// aufgerufen (promoteSubmission ist gemockt) — nur Import-Schutz fuer den Test.
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibraryById: vi.fn() }) },
}));
vi.mock('@/lib/shadow-twin/shadow-twin-config', () => ({ getShadowTwinConfig: vi.fn() }));
vi.mock('@/lib/shadow-twin/artifact-writer', () => ({ writeArtifact: vi.fn() }));
vi.mock('@/lib/shadow-twin/store/shadow-twin-service', () => ({ ShadowTwinService: { create: vi.fn() } }));

import { POST as promote } from '@/app/api/submissions/[id]/promote/route';
import { StorageError } from '@/lib/storage/types';

function login(email: string): void {
  h.auth.mockResolvedValue({ userId: 'u1' });
  h.currentUser.mockResolvedValue({});
  h.getPreferredUserEmail.mockReturnValue(email);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
function req(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/submissions/${id}/promote`, { method: 'POST' });
}

const ready = { id: 's1', libraryId: 'lib-1', status: 'ready', createdBy: 'anna@example.com', binaryRefs: [] };

/** changeSubmissionStatus liefert nacheinander den jeweils gesetzten Status zurueck. */
function statusReturns(...statuses: string[]): void {
  for (const status of statuses) {
    h.changeSubmissionStatus.mockResolvedValueOnce({ ...ready, status });
  }
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('promote', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect((await promote(req('s1'), params('s1'))).status).toBe(401);
  });

  it('404 wenn Submission fehlt', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(null);
    expect((await promote(req('s1'), params('s1'))).status).toBe(404);
  });

  it('403 wenn kein Reviewer (contributor/moderator)', async () => {
    login('mod@example.com');
    h.getSubmissionById.mockResolvedValue(ready);
    h.isCoCreatorOrOwner.mockResolvedValue(false);
    const res = await promote(req('s1'), params('s1'));
    expect(res.status).toBe(403);
    expect(h.changeSubmissionStatus).not.toHaveBeenCalled();
    expect(h.promoteSubmission).not.toHaveBeenCalled();
  });

  it('409 wenn nicht ready (unzulaessiger Uebergang)', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue({ ...ready, status: 'pending' });
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.changeSubmissionStatus.mockRejectedValue(
      Object.assign(new Error('Ungueltiger Status-Uebergang'), { name: 'InvalidSubmissionTransitionError' }),
    );
    const res = await promote(req('s1'), params('s1'));
    expect(res.status).toBe(409);
    expect(h.promoteSubmission).not.toHaveBeenCalled();
  });

  it('200 No-Op wenn bereits published (idempotent)', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue({ ...ready, status: 'published' });
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    const res = await promote(req('s1'), params('s1'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ alreadyPublished: true });
    expect(h.changeSubmissionStatus).not.toHaveBeenCalled();
    expect(h.promoteSubmission).not.toHaveBeenCalled();
  });

  it('200 Erfolg: ready -> publishing -> published + savedItemId', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(ready);
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    statusReturns('publishing', 'published');
    h.getServerProvider.mockResolvedValue({});
    h.promoteSubmission.mockResolvedValue({
      savedItemId: 'doc-1',
      fileName: 'x.md',
      alreadyPresent: false,
      targetFolderId: 'inbox-1',
      targetFolderName: 'inbox',
    });

    const res = await promote(req('s1'), params('s1'));
    expect(res.status).toBe(200);
    // Route reicht Zielordner + Dateiname an den Client zurueck (Wizard-Summary).
    await expect(res.json()).resolves.toMatchObject({
      savedItemId: 'doc-1',
      fileName: 'x.md',
      targetFolderId: 'inbox-1',
      targetFolderName: 'inbox',
    });

    expect(h.changeSubmissionStatus).toHaveBeenCalledTimes(2);
    expect(h.changeSubmissionStatus.mock.calls[0][1]).toMatchObject({ to: 'publishing', actor: 'rev@example.com' });
    expect(h.changeSubmissionStatus.mock.calls[1][1]).toMatchObject({ to: 'published', actor: 'rev@example.com' });
    // Die reine Logik bekommt die Submission im publishing-Status.
    expect(h.promoteSubmission.mock.calls[0][0].submission).toMatchObject({ status: 'publishing' });
  });

  it('Token weg: StorageError(AUTH_ERROR) -> Ruecksprung auf ready, 503 + needsReauth', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(ready);
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    statusReturns('publishing', 'ready');
    h.getServerProvider.mockResolvedValue({});
    h.promoteSubmission.mockRejectedValue(new StorageError('Zugriff verweigert', 'AUTH_ERROR', 'onedrive'));

    const res = await promote(req('s1'), params('s1'));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ kind: 'auth', needsReauth: true, retryable: true });

    expect(h.changeSubmissionStatus).toHaveBeenCalledTimes(2);
    expect(h.changeSubmissionStatus.mock.calls[1][1]).toMatchObject({ to: 'ready' });
  });

  it('Speicher offline: StorageError(NETWORK_ERROR) -> Ruecksprung auf ready, 503 ohne Re-Auth', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(ready);
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    statusReturns('publishing', 'ready');
    h.getServerProvider.mockResolvedValue({});
    h.promoteSubmission.mockRejectedValue(new StorageError('Netzwerkfehler', 'NETWORK_ERROR', 'onedrive'));

    const res = await promote(req('s1'), params('s1'));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ kind: 'storage', needsReauth: false });
    expect(h.changeSubmissionStatus.mock.calls[1][1]).toMatchObject({ to: 'ready' });
  });
});
