/**
 * Tests fuer die reine Analyse-Job-Fabrik (Welle III):
 * pickAnalyzableBinaryRef (explizite Fehler) + buildSubmissionAnalysisJob
 * (Inbox-Scope, Ingest deaktiviert, Submission-Korrelation).
 */

import { describe, expect, it } from 'vitest';
import {
  buildSubmissionAnalysisJob,
  buildSubmissionAnalysisParameters,
  buildSubmissionAnalysisSteps,
  pickAnalyzableBinaryRef,
} from '@/lib/submissions/submission-analysis-job';
import type { WizardSubmission, SubmissionBinaryRef } from '@/types/wizard-submission';

const PDF_REF: SubmissionBinaryRef = {
  hash: 'abc',
  url: 'https://blob/lib-1/inbox/alice/abc.pdf',
  fileName: 'Quelle.pdf',
  contentType: 'application/pdf',
  itemId: 'lib-1/inbox/alice/abc.pdf',
};

function submissionWith(refs: SubmissionBinaryRef[]): WizardSubmission {
  return {
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
    binaryRefs: refs,
    confidence: {},
    target: {},
    review: {},
    events: [],
    createdAt: '2026-06-11T10:00:00.000Z',
    updatedAt: '2026-06-11T10:00:00.000Z',
    version: 1,
  };
}

describe('pickAnalyzableBinaryRef', () => {
  it('liefert die erste PDF-Ref mit itemId', () => {
    expect(pickAnalyzableBinaryRef(submissionWith([PDF_REF]))).toEqual(PDF_REF);
  });

  it('wirft bei leeren Refs, ohne PDF und ohne itemId (klare Ursachen)', () => {
    expect(() => pickAnalyzableBinaryRef(submissionWith([]))).toThrow(/keine Binaerquelle/);
    expect(() =>
      pickAnalyzableBinaryRef(submissionWith([{ ...PDF_REF, contentType: 'image/png' }])),
    ).toThrow(/keine PDF/);
    expect(() =>
      pickAnalyzableBinaryRef(submissionWith([{ ...PDF_REF, itemId: undefined }])),
    ).toThrow(/itemId/);
  });
});

describe('buildSubmissionAnalysisJob', () => {
  const job = buildSubmissionAnalysisJob({
    submission: submissionWith([PDF_REF]),
    ref: PDF_REF,
    parentId: 'lib-1/inbox/alice/',
    userEmail: 'anna@example.com',
    jobId: 'job-1',
    jobSecretHash: 'hash-1',
  });

  it('ist ein queued PDF-Job im Inbox-Scope', () => {
    expect(job).toMatchObject({
      jobId: 'job-1',
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId: 'lib-1',
      userEmail: 'anna@example.com',
      providerScope: 'inbox',
    });
  });

  it('korreliert Quelle (itemId/parentId vom Provider) und Submission', () => {
    expect(job.correlation.source).toMatchObject({
      mediaType: 'pdf',
      name: 'Quelle.pdf',
      itemId: PDF_REF.itemId,
      parentId: 'lib-1/inbox/alice/',
    });
    expect(job.correlation.options).toMatchObject({
      submissionId: 'sub-1',
      targetLanguage: 'de',
      extractionMethod: 'mistral_ocr',
    });
  });

  it('Parameter: Template = Standard-Vorlage des detailViewType (F11), Ingest deaktiviert (W5)', () => {
    // detailViewType 'book' -> Builtin-Default 'standard-book' (nicht der docType 'pdfanalyse').
    const params = buildSubmissionAnalysisParameters(submissionWith([PDF_REF]));
    expect(params).toMatchObject({
      template: 'standard-book',
      phases: { extract: true, template: true, ingest: false },
      policies: { ingest: 'ignore' },
    });
  });

  it('Steps entsprechen dem process-pdf-Muster', () => {
    expect(buildSubmissionAnalysisSteps().map((s) => s.name)).toEqual([
      'extract_pdf',
      'transform_template',
      'ingest_rag',
    ]);
  });
});
