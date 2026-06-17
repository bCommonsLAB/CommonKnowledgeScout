/**
 * Tests fuer die reine Analyse-Job-Fabrik (Welle III; U5b medien-agnostisch):
 * pickAnalyzableSource (explizite Fehler + Medien-Aufloesung) +
 * buildSubmissionAnalysisJob (Inbox-Scope, Ingest deaktiviert, Submission-
 * Korrelation) fuer PDF (unveraendert) UND Audio.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSubmissionAnalysisJob,
  buildSubmissionAnalysisParameters,
  buildSubmissionAnalysisSteps,
  pickAnalyzableSource,
} from '@/lib/submissions/submission-analysis-job';
import type { WizardSubmission, SubmissionBinaryRef } from '@/types/wizard-submission';

const PDF_REF: SubmissionBinaryRef = {
  hash: 'abc',
  url: 'https://blob/lib-1/inbox/alice/abc.pdf',
  fileName: 'Quelle.pdf',
  contentType: 'application/pdf',
  itemId: 'lib-1/inbox/alice/abc.pdf',
};

const AUDIO_REF: SubmissionBinaryRef = {
  hash: 'def',
  url: 'https://blob/lib-1/inbox/alice/def.mp3',
  fileName: 'Interview.mp3',
  contentType: 'audio/mpeg',
  itemId: 'lib-1/inbox/alice/def.mp3',
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

describe('pickAnalyzableSource', () => {
  it('liefert die erste PDF-Ref mit itemId + Medien-Identitaet', () => {
    expect(pickAnalyzableSource(submissionWith([PDF_REF]))).toEqual({
      ref: PDF_REF,
      media: { jobType: 'pdf', mediaType: 'pdf', extractStepName: 'extract_pdf' },
    });
  });

  it('liefert Audio-Refs mit dem Audio-Medien-Mapping', () => {
    expect(pickAnalyzableSource(submissionWith([AUDIO_REF]))).toEqual({
      ref: AUDIO_REF,
      media: { jobType: 'audio', mediaType: 'audio', extractStepName: 'extract_audio' },
    });
  });

  it('wirft bei leeren Refs, ohne unterstuetzten Typ und ohne itemId (klare Ursachen)', () => {
    expect(() => pickAnalyzableSource(submissionWith([]))).toThrow(/keine Binaerquelle/);
    expect(() =>
      pickAnalyzableSource(submissionWith([{ ...PDF_REF, contentType: 'image/png' }])),
    ).toThrow(/keine analysierbare Binaerquelle/);
    expect(() =>
      pickAnalyzableSource(submissionWith([{ ...PDF_REF, itemId: undefined }])),
    ).toThrow(/itemId/);
  });
});

describe('buildSubmissionAnalysisJob — PDF (unveraendert)', () => {
  const source = pickAnalyzableSource(submissionWith([PDF_REF]));
  const job = buildSubmissionAnalysisJob({
    submission: submissionWith([PDF_REF]),
    source,
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

  it('korreliert Quelle (itemId/parentId vom Provider) und Submission, PDF-OCR-Optionen', () => {
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
    const params = buildSubmissionAnalysisParameters(submissionWith([PDF_REF]), source.media);
    expect(params).toMatchObject({
      template: 'standard-book',
      extractionMethod: 'mistral_ocr',
      phases: { extract: true, template: true, ingest: false },
      policies: { extract: 'do', metadata: 'do', ingest: 'ignore' },
    });
  });

  it('5a transcriptOnly: Transform-Phase aus, Metadaten-Policy ignore (nur Extract)', () => {
    const params = buildSubmissionAnalysisParameters(submissionWith([PDF_REF]), source.media, {
      transcriptOnly: true,
    });
    expect(params).toMatchObject({
      phases: { extract: true, template: false, ingest: false },
      policies: { extract: 'do', metadata: 'ignore', ingest: 'ignore' },
    });
  });

  it('Steps entsprechen dem process-pdf-Muster', () => {
    expect(buildSubmissionAnalysisSteps(source.media.extractStepName).map((s) => s.name)).toEqual([
      'extract_pdf',
      'transform_template',
      'ingest_rag',
    ]);
  });
});

describe('buildSubmissionAnalysisJob — Audio', () => {
  const source = pickAnalyzableSource(submissionWith([AUDIO_REF]));
  const job = buildSubmissionAnalysisJob({
    submission: submissionWith([AUDIO_REF]),
    source,
    parentId: 'lib-1/inbox/alice/',
    userEmail: 'anna@example.com',
    jobId: 'job-2',
    jobSecretHash: 'hash-2',
  });

  it('ist ein queued Audio-Job im Inbox-Scope', () => {
    expect(job).toMatchObject({ job_type: 'audio', providerScope: 'inbox', operation: 'extract' });
    expect(job.correlation.source).toMatchObject({ mediaType: 'audio', name: 'Interview.mp3' });
  });

  it('correlation.options nutzt Audio-Optionen (sourceLanguage), KEINE OCR-Flags', () => {
    expect(job.correlation.options).toMatchObject({
      submissionId: 'sub-1',
      targetLanguage: 'de',
      sourceLanguage: 'auto',
    });
    expect(job.correlation.options).not.toHaveProperty('extractionMethod');
    expect(job.correlation.options).not.toHaveProperty('includeOcrImages');
  });

  it('Steps starten mit extract_audio', () => {
    expect(buildSubmissionAnalysisSteps(source.media.extractStepName).map((s) => s.name)).toEqual([
      'extract_audio',
      'transform_template',
      'ingest_rag',
    ]);
  });
});
