/**
 * Tests fuer `GET /api/submissions/[id]` (Detail/Preview), ADR-0004 W2.
 * Sichtbar fuer Reviewer (co-creator/owner) ODER den Erfasser selbst.
 * Clerk, Membership-Check und Repo gemockt; `normalizeEmail` laeuft echt.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getPreferredUserEmail: vi.fn(),
  isCoCreatorOrOwner: vi.fn(),
  getSubmissionById: vi.fn(),
  updateSubmissionMetadata: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }));
vi.mock('@/lib/auth/user-email', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/auth/user-email')>()),
  getPreferredUserEmail: h.getPreferredUserEmail,
}));
vi.mock('@/lib/repositories/library-members-repo', () => ({ isCoCreatorOrOwner: h.isCoCreatorOrOwner }));
vi.mock('@/lib/repositories/wizard-submissions-repo', () => ({
  getSubmissionById: h.getSubmissionById,
  updateSubmissionMetadata: h.updateSubmissionMetadata,
}));

import { GET, PATCH } from '@/app/api/submissions/[id]/route';

function login(email: string): void {
  h.auth.mockResolvedValue({ userId: 'user-1' });
  h.currentUser.mockResolvedValue({});
  h.getPreferredUserEmail.mockReturnValue(email);
}

function call(id: string) {
  const req = new NextRequest(`http://localhost/api/submissions/${id}`, { method: 'GET' });
  return GET(req, { params: Promise.resolve({ id }) });
}

function patchCall(id: string, body: unknown) {
  const req = new NextRequest(`http://localhost/api/submissions/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.resetAllMocks();
});

it('401 ohne Auth', async () => {
  h.auth.mockResolvedValue({ userId: null });
  expect((await call('s1')).status).toBe(401);
});

it('404 wenn Submission fehlt', async () => {
  login('u@example.com');
  h.getSubmissionById.mockResolvedValue(null);
  expect((await call('s1')).status).toBe(404);
});

it('403 wenn weder Reviewer noch Erfasser', async () => {
  login('fremd@example.com');
  h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
  h.isCoCreatorOrOwner.mockResolvedValue(false);
  expect((await call('s1')).status).toBe(403);
});

it('200 fuer Reviewer (co-creator/owner)', async () => {
  login('rev@example.com');
  h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
  h.isCoCreatorOrOwner.mockResolvedValue(true);
  const res = await call('s1');
  expect(res.status).toBe(200);
  expect((await res.json()).submission.id).toBe('s1');
});

it('200 fuer den Erfasser selbst (auch ohne Review-Recht), E-Mail normalisiert', async () => {
  login('Anna@Example.com');
  h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
  h.isCoCreatorOrOwner.mockResolvedValue(false);
  expect((await call('s1')).status).toBe(200);
});

describe('PATCH /api/submissions/[id]', () => {
  it('404 wenn Submission fehlt', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(null);
    expect((await patchCall('s1', { markdownBody: 'x' })).status).toBe(404);
  });

  it('403 wenn kein Reviewer (Erfasser darf nicht korrigieren)', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
    h.isCoCreatorOrOwner.mockResolvedValue(false);
    const res = await patchCall('s1', { markdownBody: 'x' });
    expect(res.status).toBe(403);
    expect(h.updateSubmissionMetadata).not.toHaveBeenCalled();
  });

  it('400 bei ungueltigem Body (metadata kein Objekt)', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    const res = await patchCall('s1', { metadata: 'kaputt' });
    expect(res.status).toBe(400);
    expect(h.updateSubmissionMetadata).not.toHaveBeenCalled();
  });

  it('200 Reviewer korrigiert -> updateSubmissionMetadata', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.updateSubmissionMetadata.mockResolvedValue({ id: 's1', markdownBody: 'neu' });
    const res = await patchCall('s1', { markdownBody: 'neu', metadata: { title: 'T' } });
    expect(res.status).toBe(200);
    expect(h.updateSubmissionMetadata).toHaveBeenCalledWith('s1', {
      markdownBody: 'neu',
      metadata: { title: 'T' },
    });
  });

  it('409 wenn nicht editierbar (terminaler Status)', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue({ id: 's1', libraryId: 'lib-1', createdBy: 'anna@example.com' });
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.updateSubmissionMetadata.mockRejectedValue(
      Object.assign(new Error('nicht editierbar'), { name: 'SubmissionNotEditableError' }),
    );
    expect((await patchCall('s1', { markdownBody: 'x' })).status).toBe(409);
  });
});
