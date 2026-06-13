/**
 * @fileoverview Submission-Analyse: reine Job-Fabrik (ADR-0004 II, Welle III).
 *
 * @description
 * Baut das ExternalJob-Dokument fuer die Stufe-B-Analyse einer Submission
 * (PDF -> Transkript -> Transform) — als Inbox-Job: `providerScope='inbox'`
 * (Pipeline laeuft ueber den Inbox-Provider, nie das Owner-Archiv) und
 * `phases.ingest=false` (RAG-Ingest gehoert zur Publikation, W5). Die Submission
 * wird ueber `correlation.options.submissionId` korreliert; der Rueckfluss des
 * Ergebnisses passiert bei Job-Completion (submission-analysis.ts).
 *
 * Reine Funktionen ohne Seiteneffekte — die Route haelt nur Auth/Persistenz.
 *
 * @see docs/wizards/contributor-pdf-upload-wizard.md (Stufe B)
 * @module lib/submissions
 */

import type { ExternalJob, ExternalJobStep } from '@/types/external-job';
import type { SubmissionBinaryRef, WizardSubmission } from '@/types/wizard-submission';
import { getDefaultTemplateNameForViewType } from '@/lib/templates/default-templates';

/**
 * Stufe-B-Analyse-Defaults: Mistral-OCR mit allen Bild-Flags (wie der globale
 * process-pdf-Default). Zielsprache ist vorerst fix 'de' — eine waehlbare
 * Sprache ist eine spaetere Wizard-Scheibe, kein stiller Fallback (dokumentiert).
 */
export const SUBMISSION_ANALYSIS_DEFAULTS = {
  targetLanguage: 'de',
  extractionMethod: 'mistral_ocr',
  includeOcrImages: true,
  includePreviewPages: true,
  includeHighResPages: true,
} as const;

/**
 * Waehlt die analysierbare Binaerquelle der Submission: das erste PDF mit
 * Provider-`itemId`. Wirft mit klarer Ursache (kein stiller Fallback) —
 * Refs aus Stufe A vor Welle III haben keine itemId und brauchen Re-Upload.
 */
export function pickAnalyzableBinaryRef(submission: WizardSubmission): SubmissionBinaryRef {
  if (!submission.binaryRefs.length) {
    throw new Error('Submission hat keine Binaerquelle (binaryRefs leer).');
  }
  const pdf = submission.binaryRefs.find((ref) => ref.contentType === 'application/pdf');
  if (!pdf) {
    throw new Error('Submission hat keine PDF-Binaerquelle (Stufe B analysiert PDFs).');
  }
  if (!pdf.itemId) {
    throw new Error(
      'Binaerquelle traegt keine Provider-itemId (Upload vor Welle III). Bitte PDF neu erfassen.',
    );
  }
  return pdf;
}

/** Eingaben fuer die Job-Fabrik (Identitaet + aufgeloeste Quelle). */
export interface BuildSubmissionAnalysisJobArgs {
  submission: WizardSubmission;
  /** Analysierbare Ref (aus pickAnalyzableBinaryRef). */
  ref: SubmissionBinaryRef;
  /** Eltern-Ordner-ID der Quelle im Inbox-Provider (StorageItem.parentId). */
  parentId: string;
  /** Startender User (Auditing + Job-Events). */
  userEmail: string;
  jobId: string;
  jobSecretHash: string;
}

/** Steps analog process-pdf; Ingest wird als Phase deaktiviert (W5). */
export function buildSubmissionAnalysisSteps(): ExternalJobStep[] {
  return [
    { name: 'extract_pdf', status: 'pending' },
    { name: 'transform_template', status: 'pending' },
    { name: 'ingest_rag', status: 'pending' },
  ];
}

/**
 * Job-Parameter (Welle III, an F11 angeglichen): Als Template gilt die im Code
 * persistierte **Standard-Vorlage des `detailViewType`** (z.B. `standard-book`),
 * NICHT der docType. So nutzt die Inbox-Analyse dieselbe Builtin-Default-Vorlage
 * wie die Archiv-Pipeline (`pickTemplate`/`getDefaultTemplateNameForViewType`) —
 * garantiert vorhanden (kein MongoDB-Roundtrip), fuehrt language/targetLanguage,
 * kein Bedarf an einem user-erstellten `pdfanalyse`-Template mehr.
 * Ingest bleibt deaktiviert (phases + policy — complete.ts markiert skipped;
 * phase-ingest wirft zusaetzlich bei Inbox-Scope; Publikation = W5).
 */
export function buildSubmissionAnalysisParameters(
  submission: WizardSubmission,
): Record<string, unknown> {
  return {
    ...SUBMISSION_ANALYSIS_DEFAULTS,
    template: getDefaultTemplateNameForViewType(submission.detailViewType),
    phases: { extract: true, template: true, ingest: false },
    policies: { extract: 'do', metadata: 'do', ingest: 'ignore' },
  };
}

/** Baut das ExternalJob-Dokument (status 'queued'; der Worker dispatcht). */
export function buildSubmissionAnalysisJob(args: BuildSubmissionAnalysisJobArgs): ExternalJob {
  const { submission, ref, parentId, userEmail, jobId, jobSecretHash } = args;
  const now = new Date();
  return {
    jobId,
    jobSecretHash,
    job_type: 'pdf',
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: submission.libraryId,
    userEmail,
    // Inbox-Scope: Pipeline liest/schreibt ausschliesslich in der Quarantaene (ADR-0004 II).
    providerScope: 'inbox',
    correlation: {
      jobId,
      libraryId: submission.libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: ref.contentType,
        name: ref.fileName,
        itemId: ref.itemId,
        parentId,
      },
      options: {
        targetLanguage: SUBMISSION_ANALYSIS_DEFAULTS.targetLanguage,
        extractionMethod: SUBMISSION_ANALYSIS_DEFAULTS.extractionMethod,
        includeOcrImages: SUBMISSION_ANALYSIS_DEFAULTS.includeOcrImages,
        includePreviewPages: SUBMISSION_ANALYSIS_DEFAULTS.includePreviewPages,
        includeHighResPages: SUBMISSION_ANALYSIS_DEFAULTS.includeHighResPages,
        // Korrelations-Anker fuer den Ergebnis-Rueckfluss (submission-analysis.ts).
        submissionId: submission.id,
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}
