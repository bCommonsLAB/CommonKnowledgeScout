/**
 * Tests fuer `GET /api/libraries/[id]/me/capture` (ADR-0004 E2):
 * Server-Wahrheit fuer den „Inhalte erfassen"-Button. Clerk + resolveCaptureRole
 * sind gemockt; geprueft werden Auth-Gates und das canCapture-Mapping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getPreferredUserEmail: vi.fn(),
  resolveCaptureRole: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }));
vi.mock('@/lib/auth/user-email', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/auth/user-email')>()),
  getPreferredUserEmail: h.getPreferredUserEmail,
}));
vi.mock('@/lib/submissions/capture-access', () => ({ resolveCaptureRole: h.resolveCaptureRole }));

import { GET } from '@/app/api/libraries/[id]/me/capture/route';

function req(): Request {
  return new Request('http://localhost/api/libraries/lib-1/me/capture');
}
const params = Promise.resolve({ id: 'lib-1' });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/libraries/[id]/me/capture', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect((await GET(req(), { params })).status).toBe(401);
  });

  it('400 ohne User-Email', async () => {
    h.auth.mockResolvedValue({ userId: 'user-1' });
    h.currentUser.mockResolvedValue({});
    h.getPreferredUserEmail.mockReturnValue('');
    expect((await GET(req(), { params })).status).toBe(400);
  });

  it('canCapture=true mit Rolle, wenn erfass-berechtigt', async () => {
    h.auth.mockResolvedValue({ userId: 'user-1' });
    h.currentUser.mockResolvedValue({});
    h.getPreferredUserEmail.mockReturnValue('u@example.com');
    h.resolveCaptureRole.mockResolvedValue('contributor');
    const res = await GET(req(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ canCapture: true, role: 'contributor' });
    expect(h.resolveCaptureRole).toHaveBeenCalledWith('u@example.com', 'lib-1');
  });

  it('canCapture=false ohne Recht (kein stiller Fallback auf erlaubt)', async () => {
    h.auth.mockResolvedValue({ userId: 'user-1' });
    h.currentUser.mockResolvedValue({});
    h.getPreferredUserEmail.mockReturnValue('u@example.com');
    h.resolveCaptureRole.mockResolvedValue(null);
    const res = await GET(req(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ canCapture: false, role: null });
  });
});
