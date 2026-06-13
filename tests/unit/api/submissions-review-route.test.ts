/**
 * Tests fuer `POST /api/submissions/[id]/approve` (pending->ready) und
 * `.../reject` (*->rejected), ADR-0004 W4. Beide nutzen `performReviewTransition`.
 * Nur Reviewer (co-creator/owner); unzulaessiger Uebergang -> 409.
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

import { POST as approve } from '@/app/api/submissions/[id]/approve/route';
import { POST as reject } from '@/app/api/submissions/[id]/reject/route';

function login(email: string): void {
  h.auth.mockResolvedValue({ userId: 'user-1' });
  h.currentUser.mockResolvedValue({});
  h.getPreferredUserEmail.mockReturnValue(email);
}

function req(id: string, body?: unknown): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] =
    body === undefined
      ? { method: 'POST' }
      : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
  return new NextRequest(`http://localhost/api/submissions/${id}/x`, init);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const existingPending = { id: 's1', libraryId: 'lib-1', status: 'pending', createdBy: 'anna@example.com' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('approve', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect((await approve(req('s1'), params('s1'))).status).toBe(401);
  });

  it('404 wenn Submission fehlt', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(null);
    expect((await approve(req('s1'), params('s1'))).status).toBe(404);
  });

  it('403 wenn kein Reviewer', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue(existingPending);
    h.isCoCreatorOrOwner.mockResolvedValue(false);
    const res = await approve(req('s1'), params('s1'));
    expect(res.status).toBe(403);
    expect(h.changeSubmissionStatus).not.toHaveBeenCalled();
  });

  it('200 Reviewer gibt frei -> changeSubmissionStatus to ready', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(existingPending);
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.changeSubmissionStatus.mockResolvedValue({ id: 's1', status: 'ready' });
    const res = await approve(req('s1'), params('s1'));
    expect(res.status).toBe(200);
    const [id, input] = h.changeSubmissionStatus.mock.calls[0];
    expect(id).toBe('s1');
    expect(input).toMatchObject({ to: 'ready', actor: 'rev@example.com' });
    expect(typeof input.at).toBe('string');
    expect(input).not.toHaveProperty('note');
  });

  it('409 bei unzulaessigem Uebergang', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue({ ...existingPending, status: 'published' });
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.changeSubmissionStatus.mockRejectedValue(
      Object.assign(new Error('Ungueltiger Status-Uebergang'), { name: 'InvalidSubmissionTransitionError' }),
    );
    expect((await approve(req('s1'), params('s1'))).status).toBe(409);
  });
});

describe('reject', () => {
  it('200 mit Ablehnungsgrund -> changeSubmissionStatus to rejected + note', async () => {
    login('rev@example.com');
    h.getSubmissionById.mockResolvedValue(existingPending);
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.changeSubmissionStatus.mockResolvedValue({ id: 's1', status: 'rejected' });
    const res = await reject(req('s1', { note: 'Quelle fehlt' }), params('s1'));
    expect(res.status).toBe(200);
    expect(h.changeSubmissionStatus.mock.calls[0][1]).toMatchObject({
      to: 'rejected',
      actor: 'rev@example.com',
      note: 'Quelle fehlt',
    });
  });

  it('403 wenn kein Reviewer', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue(existingPending);
    h.isCoCreatorOrOwner.mockResolvedValue(false);
    expect((await reject(req('s1', { note: 'x' }), params('s1'))).status).toBe(403);
  });
});
