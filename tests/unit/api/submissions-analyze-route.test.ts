/**
 * Tests fuer `POST /api/submissions/[id]/analyze` (Welle III):
 * Auth-/Rechte-/Status-Gates und die Form des erzeugten Inbox-Jobs
 * (providerScope='inbox', phases.ingest=false, Submission-Korrelation).
 * Clerk, Repos und Inbox-Provider sind gemockt; die Job-Fabrik laeuft echt.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getPreferredUserEmail: vi.fn(),
  isCoCreatorOrOwner: vi.fn(),
  getSubmissionById: vi.fn(),
  getInboxProvider: vi.fn(),
  getItemById: vi.fn(),
  create: vi.fn(),
  initializeSteps: vi.fn(),
  initializeTrace: vi.fn(),
  traceAddEvent: vi.fn(),
  hashSecret: vi.fn(() => 'hash'),
  tickNow: vi.fn(async () => undefined),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }));
vi.mock('@/lib/auth/user-email', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/auth/user-email')>()),
  getPreferredUserEmail: h.getPreferredUserEmail,
}));
vi.mock('@/lib/repositories/library-members-repo', () => ({
  isCoCreatorOrOwner: h.isCoCreatorOrOwner,
}));
vi.mock('@/lib/repositories/wizard-submissions-repo', () => ({
  getSubmissionById: h.getSubmissionById,
}));
// default-templates (F11) laeuft ECHT (reine Funktionen) — kein Mock; so testen
// wir die echte Builtin-Aufloesung 'standard-book' der Inbox-Analyse.
vi.mock('@/lib/storage/inbox/inbox-provider-entry', () => ({
  getInboxProvider: h.getInboxProvider,
}));
vi.mock('@/lib/external-jobs-repository', () => ({
  ExternalJobsRepository: class {
    hashSecret = h.hashSecret;
    create = h.create;
    initializeSteps = h.initializeSteps;
    initializeTrace = h.initializeTrace;
    traceAddEvent = h.traceAddEvent;
  },
}));
vi.mock('@/lib/events/job-event-bus', () => ({
  getJobEventBus: () => ({ emitUpdate: vi.fn() }),
}));
// Worker mocken: kein echtes setInterval im Test, und der Poke ist pruefbar.
vi.mock('@/lib/external-jobs-worker', () => ({
  ExternalJobsWorker: {
    tickNow: h.tickNow,
    getStatus: () => ({ state: 'running' }),
    start: vi.fn(),
  },
}));

import { POST } from '@/app/api/submissions/[id]/analyze/route';

const SUBMISSION = {
  id: 'sub-1',
  libraryId: 'lib-1',
  status: 'pending',
  createdBy: 'anna@example.com',
  createdByRole: 'contributor',
  wizardId: 'pdf-upload',
  docType: 'pdfanalyse',
  detailViewType: 'book',
  metadata: { title: 'Quelle.pdf' },
  markdownBody: '',
  binaryRefs: [
    {
      hash: 'abc',
      url: 'https://blob/x.pdf',
      fileName: 'Quelle.pdf',
      contentType: 'application/pdf',
      itemId: 'lib-1/inbox/anna/abc.pdf',
    },
  ],
  confidence: {},
  target: {},
  review: {},
  events: [],
  createdAt: '',
  updatedAt: '',
  version: 1,
};

function req(): NextRequest {
  return new NextRequest('http://localhost/api/submissions/sub-1/analyze', { method: 'POST' });
}
const params = Promise.resolve({ id: 'sub-1' });

function login(email: string): void {
  h.auth.mockResolvedValue({ userId: 'user-1' });
  h.currentUser.mockResolvedValue({});
  h.getPreferredUserEmail.mockReturnValue(email);
}

beforeEach(() => {
  vi.resetAllMocks();
  h.hashSecret.mockReturnValue('hash');
  // resetAllMocks loescht die Implementierung — tickNow muss ein Promise liefern.
  h.tickNow.mockResolvedValue(undefined);
  // detailViewType 'book' -> Builtin 'standard-book' existiert real (kein Mock noetig).
  h.getInboxProvider.mockResolvedValue({ getItemById: h.getItemById });
  h.getItemById.mockResolvedValue({ id: 'lib-1/inbox/anna/abc.pdf', parentId: 'lib-1/inbox/anna/' });
});

describe('POST /api/submissions/[id]/analyze', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect((await POST(req(), { params })).status).toBe(401);
  });

  it('404 bei unbekannter Submission', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue(null);
    expect((await POST(req(), { params })).status).toBe(404);
  });

  it('403 wenn weder Erfasser noch Reviewer', async () => {
    login('fremd@example.com');
    h.getSubmissionById.mockResolvedValue(SUBMISSION);
    h.isCoCreatorOrOwner.mockResolvedValue(false);
    expect((await POST(req(), { params })).status).toBe(403);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('409 wenn Status nicht pending', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue({ ...SUBMISSION, status: 'ready' });
    expect((await POST(req(), { params })).status).toBe(409);
  });

  it('422 wenn der detailViewType kein Builtin-Standard-Template hat (Pre-flight, kein Job)', async () => {
    login('anna@example.com');
    // Unbekannter detailViewType -> kein 'standard-<typ>'-Builtin -> 422 vor jeder teuren Operation.
    h.getSubmissionById.mockResolvedValue({ ...SUBMISSION, detailViewType: 'unbekannterTyp' });
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/detailViewType|unbekannt/i);
    expect(h.getInboxProvider).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
  });

  it('422 wenn die Ref keine itemId traegt (Alt-Upload, Re-Upload noetig)', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue({
      ...SUBMISSION,
      binaryRefs: [{ ...SUBMISSION.binaryRefs[0], itemId: undefined }],
    });
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('202 Erfasser: legt queued Inbox-Job mit Submission-Korrelation an', async () => {
    login('anna@example.com');
    h.getSubmissionById.mockResolvedValue(SUBMISSION);
    const res = await POST(req(), { params });
    expect(res.status).toBe(202);
    expect((await res.json()).jobId).toBeTruthy();
    // Erfasser braucht keinen Reviewer-Check.
    expect(h.isCoCreatorOrOwner).not.toHaveBeenCalled();
    // Worker wird sofort angestossen, damit der Job nicht erst beim naechsten
    // Hintergrund-Poll startet (behebt den Wizard-Timeout).
    expect(h.tickNow).toHaveBeenCalled();

    const job = h.create.mock.calls[0][0];
    expect(job).toMatchObject({
      job_type: 'pdf',
      status: 'queued',
      providerScope: 'inbox',
      libraryId: 'lib-1',
      userEmail: 'anna@example.com',
    });
    expect(job.correlation.source).toMatchObject({
      itemId: 'lib-1/inbox/anna/abc.pdf',
      parentId: 'lib-1/inbox/anna/',
      name: 'Quelle.pdf',
    });
    expect(job.correlation.options.submissionId).toBe('sub-1');

    // Ingest ist deaktiviert (Publikation = W5).
    const params2 = h.initializeSteps.mock.calls[0][2];
    expect(params2.phases).toEqual({ extract: true, template: true, ingest: false });
    // F11: Template = Builtin-Standard des detailViewType 'book', nicht der docType.
    expect(params2.policies.ingest).toBe('ignore');
    expect(params2.template).toBe('standard-book');
  });

  it('202 Reviewer (co-creator/owner) darf ebenfalls starten', async () => {
    login('reviewer@example.com');
    h.getSubmissionById.mockResolvedValue(SUBMISSION);
    h.isCoCreatorOrOwner.mockResolvedValue(true);
    expect((await POST(req(), { params })).status).toBe(202);
    expect(h.isCoCreatorOrOwner).toHaveBeenCalledWith('lib-1', 'reviewer@example.com');
  });
});
