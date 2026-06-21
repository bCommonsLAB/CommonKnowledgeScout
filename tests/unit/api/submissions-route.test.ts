/**
 * Tests fuer `POST /api/submissions` (Erfassung -> Inbox) und
 * `GET /api/submissions` (Inbox-Liste), ADR-0004 W2.
 * Clerk, LibraryService, Membership-Check und Repo sind gemockt; die reine
 * Capture-Logik (parse/build) + Status-Maschine laufen echt.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getPreferredUserEmail: vi.fn(),
  getLibrary: vi.fn(),
  isCoCreatorOrOwner: vi.fn(),
  getActiveMemberRole: vi.fn(),
  createSubmission: vi.fn(),
  listSubmissions: vi.fn(),
  getInboxProvider: vi.fn(),
  uploadInboxBinary: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }));
vi.mock('@/lib/auth/user-email', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/auth/user-email')>()),
  getPreferredUserEmail: h.getPreferredUserEmail,
}));
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: h.getLibrary }) },
}));
vi.mock('@/lib/repositories/library-members-repo', () => ({
  isCoCreatorOrOwner: h.isCoCreatorOrOwner,
  getActiveMemberRole: h.getActiveMemberRole,
}));
vi.mock('@/lib/repositories/wizard-submissions-repo', () => ({
  createSubmission: h.createSubmission,
  listSubmissions: h.listSubmissions,
}));
vi.mock('@/lib/storage/inbox/inbox-provider-entry', () => ({
  getInboxProvider: h.getInboxProvider,
  inboxUsernameFromEmail: (email: string) => email,
}));
vi.mock('@/lib/submissions/inbox-upload', () => ({ uploadInboxBinary: h.uploadInboxBinary }));

import { POST, GET } from '@/app/api/submissions/route';

const VALID = {
  libraryId: 'lib-1',
  wizardId: 'w1',
  docType: 'testimonial',
  detailViewType: 'testimonial',
  markdownBody: '# Hallo',
  metadata: { title: 'X' },
};

function login(email: string): void {
  h.auth.mockResolvedValue({ userId: 'user-1' });
  h.currentUser.mockResolvedValue({});
  h.getPreferredUserEmail.mockReturnValue(email);
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function getReq(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/submissions${query}`, { method: 'GET' });
}

const MULTIPART_FIELDS = {
  libraryId: 'lib-1',
  wizardId: 'pdf-upload',
  docType: 'pdfanalyse',
  detailViewType: 'book',
  markdownBody: '',
  metadata: JSON.stringify({ title: 'Quelle.pdf' }),
};

function postMultipart(fields: Record<string, string>, withFile = true): NextRequest {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (withFile) form.set('file', new File([Buffer.from('%PDF-1.4')], 'Quelle.pdf', { type: 'application/pdf' }));
  // FormData als Body setzt content-type multipart/form-data inkl. boundary.
  return new NextRequest('http://localhost/api/submissions', { method: 'POST', body: form });
}

function postMultipartFiles(fields: Record<string, string>, fileNames: string[]): NextRequest {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const name of fileNames) form.append('file', new File([Buffer.from('%PDF-1.4')], name, { type: 'application/pdf' }));
  return new NextRequest('http://localhost/api/submissions', { method: 'POST', body: form });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /api/submissions', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect((await POST(postReq(VALID))).status).toBe(401);
  });

  it('400 ohne User-Email', async () => {
    login('');
    expect((await POST(postReq(VALID))).status).toBe(400);
  });

  it('400 bei ungueltigem JSON', async () => {
    login('u@example.com');
    expect((await POST(postReq('{kaputt'))).status).toBe(400);
  });

  it('400 bei Validierungsfehler im Body (kein Schreibzugriff)', async () => {
    login('u@example.com');
    const res = await POST(postReq({ ...VALID, wizardId: '' }));
    expect(res.status).toBe(400);
    expect(h.createSubmission).not.toHaveBeenCalled();
  });

  it('403 ohne Erfass-Recht (z.B. moderator oder Nicht-Mitglied)', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue(null);
    h.getActiveMemberRole.mockResolvedValue('moderator');
    const res = await POST(postReq(VALID));
    expect(res.status).toBe(403);
    expect(h.createSubmission).not.toHaveBeenCalled();
  });

  it('201 Owner -> Submission pending mit Rolle owner (kein Member-Lookup noetig)', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue({ id: 'lib-1' });
    h.createSubmission.mockResolvedValue({ id: 'sub-1', status: 'pending' });
    const res = await POST(postReq(VALID));
    expect(res.status).toBe(201);
    expect(h.getActiveMemberRole).not.toHaveBeenCalled();
    expect(h.createSubmission.mock.calls[0][0]).toMatchObject({
      libraryId: 'lib-1',
      createdBy: 'u@example.com',
      createdByRole: 'owner',
      status: 'pending',
      metadata: { title: 'X' },
    });
  });

  it('201 Co-Creator -> Rolle co-creator', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue(null);
    h.getActiveMemberRole.mockResolvedValue('co-creator');
    h.createSubmission.mockResolvedValue({ id: 'sub-2' });
    const res = await POST(postReq(VALID));
    expect(res.status).toBe(201);
    expect(h.createSubmission.mock.calls[0][0].createdByRole).toBe('co-creator');
  });

  it('201 Contributor -> Rolle contributor (ADR-0004 E2)', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue(null);
    h.getActiveMemberRole.mockResolvedValue('contributor');
    h.createSubmission.mockResolvedValue({ id: 'sub-3' });
    const res = await POST(postReq(VALID));
    expect(res.status).toBe(201);
    expect(h.createSubmission.mock.calls[0][0].createdByRole).toBe('contributor');
  });
});

describe('POST /api/submissions (multipart, Stufe A)', () => {
  it('201: laedt die Binaerquelle ueber den Inbox-Provider und merged die Ref', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue(null);
    h.getActiveMemberRole.mockResolvedValue('contributor');
    h.getInboxProvider.mockResolvedValue({ id: 'lib-1' });
    const ref = { hash: 'abc', url: 'https://blob/lib-1/inbox/u@example.com/abc.pdf', fileName: 'Quelle.pdf', contentType: 'application/pdf', size: 8 };
    h.uploadInboxBinary.mockResolvedValue(ref);
    h.createSubmission.mockResolvedValue({ id: 'sub-pdf', status: 'pending' });

    const res = await POST(postMultipart(MULTIPART_FIELDS));
    expect(res.status).toBe(201);
    expect(h.getInboxProvider).toHaveBeenCalledWith('u@example.com', 'lib-1');
    const input = h.createSubmission.mock.calls[0][0];
    expect(input).toMatchObject({ libraryId: 'lib-1', createdByRole: 'contributor', status: 'pending', docType: 'pdfanalyse', detailViewType: 'book' });
    expect(input.binaryRefs).toEqual([ref]);
  });

  it('201 (Ordner, U5e): laedt mehrere Quellen hoch und merged alle Refs in EINE Submission', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue({ id: 'lib-1' });
    h.getInboxProvider.mockResolvedValue({ id: 'lib-1' });
    h.uploadInboxBinary
      .mockResolvedValueOnce({ hash: 'a', url: 'https://blob/lib-1/inbox/u@example.com/a.pdf', fileName: 'a.pdf', contentType: 'application/pdf' })
      .mockResolvedValueOnce({ hash: 'b', url: 'https://blob/lib-1/inbox/u@example.com/b.pdf', fileName: 'b.pdf', contentType: 'application/pdf' });
    h.createSubmission.mockResolvedValue({ id: 'sub-folder', status: 'pending' });

    const res = await POST(postMultipartFiles(MULTIPART_FIELDS, ['a.pdf', 'b.pdf']));
    expect(res.status).toBe(201);
    expect(h.uploadInboxBinary).toHaveBeenCalledTimes(2);
    const input = h.createSubmission.mock.calls[0][0];
    expect(input.binaryRefs.map((r: { fileName: string }) => r.fileName)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('400, wenn die Datei fehlt (kein Upload, kein Submit)', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue({ id: 'lib-1' });
    const res = await POST(postMultipart(MULTIPART_FIELDS, false));
    expect(res.status).toBe(400);
    expect(h.getInboxProvider).not.toHaveBeenCalled();
    expect(h.createSubmission).not.toHaveBeenCalled();
  });

  it('403 ohne Erfass-Recht -> kein Upload (Rechte vor dem Blob)', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue(null);
    h.getActiveMemberRole.mockResolvedValue('moderator');
    const res = await POST(postMultipart(MULTIPART_FIELDS));
    expect(res.status).toBe(403);
    expect(h.uploadInboxBinary).not.toHaveBeenCalled();
    expect(h.createSubmission).not.toHaveBeenCalled();
  });

  it('413 bei zu grosser Datei -> kein Upload, kein Submit (Crash-Haertung 1b)', async () => {
    login('u@example.com');
    h.getLibrary.mockResolvedValue({ id: 'lib-1' });
    // Winziges Limit erzwingt den Guard schon bei der 8-Byte-Test-PDF.
    const prev = process.env.SUBMISSION_MAX_FILE_BYTES;
    process.env.SUBMISSION_MAX_FILE_BYTES = '1';
    try {
      const res = await POST(postMultipart(MULTIPART_FIELDS));
      expect(res.status).toBe(413);
      expect(h.getInboxProvider).not.toHaveBeenCalled();
      expect(h.uploadInboxBinary).not.toHaveBeenCalled();
      expect(h.createSubmission).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.SUBMISSION_MAX_FILE_BYTES;
      else process.env.SUBMISSION_MAX_FILE_BYTES = prev;
    }
  });
});

describe('GET /api/submissions', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect((await GET(getReq('?libraryId=lib-1'))).status).toBe(401);
  });

  it('400 ohne libraryId', async () => {
    login('u@example.com');
    expect((await GET(getReq(''))).status).toBe(400);
  });

  it('403 ohne Review-Recht', async () => {
    login('u@example.com');
    h.isCoCreatorOrOwner.mockResolvedValue(false);
    expect((await GET(getReq('?libraryId=lib-1'))).status).toBe(403);
  });

  it('400 bei ungueltigem status-Filter', async () => {
    login('u@example.com');
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    expect((await GET(getReq('?libraryId=lib-1&status=foo'))).status).toBe(400);
  });

  it('200 liefert die Liste und reicht den status-Filter durch', async () => {
    login('u@example.com');
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    h.listSubmissions.mockResolvedValue([{ id: 's1' }]);
    const res = await GET(getReq('?libraryId=lib-1&status=pending'));
    expect(res.status).toBe(200);
    expect((await res.json()).submissions).toHaveLength(1);
    expect(h.listSubmissions).toHaveBeenCalledWith('lib-1', { status: 'pending' });
  });

  it('mine=true: eigene Beitraege ohne Reviewer-Recht (createdBy-Filter)', async () => {
    login('anna@example.com');
    h.listSubmissions.mockResolvedValue([{ id: 's1' }]);
    const res = await GET(getReq('?libraryId=lib-1&mine=true'));
    expect(res.status).toBe(200);
    // Kein Reviewer-Check noetig; Filter auf den Erfasser.
    expect(h.isCoCreatorOrOwner).not.toHaveBeenCalled();
    expect(h.listSubmissions).toHaveBeenCalledWith('lib-1', { createdBy: 'anna@example.com' });
  });
});
