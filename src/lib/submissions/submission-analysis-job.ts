/**
 * @fileoverview Submission-Analyse: reine Job-Fabrik (ADR-0004 II, Welle III; U5b medien-agnostisch).
 *
 * @description
 * Baut das ExternalJob-Dokument fuer die Stufe-B-Analyse einer Submission
 * (Datei -> Transkript/Extract -> Transform) — als Inbox-Job: `providerScope='inbox'`
 * (Pipeline laeuft ueber den Inbox-Provider, nie das Owner-Archiv) und
 * `phases.ingest=false` (RAG-Ingest gehoert zur Publikation, W5). Die Submission
 * wird ueber `correlation.options.submissionId` korreliert; der Rueckfluss des
 * Ergebnisses passiert bei Job-Completion (submission-analysis.ts).
 *
 * Seit U5b **medien-agnostisch**: `job_type`/Extract-Step/medienspezifische
 * `correlation.options` kommen aus `submission-media.ts` (PDF + Audio). Reine
 * Funktionen ohne Seiteneffekte — die Route haelt nur Auth/Persistenz.
 *
 * @see docs/wizards/umbauplan-generischer-erfassungs-wizard.md (U5)
 * @module lib/submissions
 */

import type { ExternalJob, ExternalJobStep } from '@/types/external-job';
import type { SubmissionBinaryRef, WizardSubmission } from '@/types/wizard-submission';
import { getDefaultTemplateNameForViewType } from '@/lib/templates/default-templates';
import {
  buildAnalysisMediaOptions,
  resolveAnalyzableMedia,
  type AnalyzableMedia,
} from '@/lib/submissions/submission-media';

/**
 * Medien-agnostische Analyse-Defaults. Zielsprache ist vorerst fix 'de' — eine
 * waehlbare Sprache ist eine spaetere Wizard-Scheibe, kein stiller Fallback
 * (dokumentiert). Medienspezifische Optionen liefert `buildAnalysisMediaOptions`.
 */
export const SUBMISSION_ANALYSIS_DEFAULTS = {
  targetLanguage: 'de',
} as const;

/** Aufgeloeste, analysierbare Quelle: Binaer-Ref + ihre Pipeline-Identitaet. */
export interface AnalyzableSource {
  ref: SubmissionBinaryRef;
  media: AnalyzableMedia;
}

/**
 * Waehlt die erste analysierbare Binaerquelle (unterstuetzter Medientyp mit
 * Provider-`itemId`) und ihre Pipeline-Identitaet. Wirft mit klarer Ursache
 * (kein stiller Fallback): leere Refs, kein unterstuetzter Typ, oder eine
 * matchende Quelle ohne `itemId` (Upload vor Welle III -> Re-Upload noetig).
 */
export function pickAnalyzableSource(submission: WizardSubmission): AnalyzableSource {
  if (!submission.binaryRefs.length) {
    throw new Error('Submission hat keine Binaerquelle (binaryRefs leer).');
  }
  for (const ref of submission.binaryRefs) {
    const media = resolveAnalyzableMedia(ref.contentType);
    if (!media) continue;
    if (!ref.itemId) {
      throw new Error(
        'Binaerquelle traegt keine Provider-itemId (Upload vor Welle III). Bitte Datei neu erfassen.',
      );
    }
    return { ref, media };
  }
  throw new Error('Submission hat keine analysierbare Binaerquelle (unterstuetzt: PDF, Audio).');
}

/** Eingaben fuer die Job-Fabrik (Identitaet + aufgeloeste Quelle). */
export interface BuildSubmissionAnalysisJobArgs {
  submission: WizardSubmission;
  /** Analysierbare Quelle inkl. Medien-Identitaet (aus pickAnalyzableSource). */
  source: AnalyzableSource;
  /** Eltern-Ordner-ID der Quelle im Inbox-Provider (StorageItem.parentId). */
  parentId: string;
  /** Startender User (Auditing + Job-Events). */
  userEmail: string;
  jobId: string;
  jobSecretHash: string;
}

/** Steps analog der Archiv-Pipeline; erster Step medienabhaengig. Ingest = Phase aus (W5). */
export function buildSubmissionAnalysisSteps(
  extractStepName: AnalyzableMedia['extractStepName'],
): ExternalJobStep[] {
  return [
    { name: extractStepName, status: 'pending' },
    { name: 'transform_template', status: 'pending' },
    { name: 'ingest_rag', status: 'pending' },
  ];
}

/**
 * Job-Parameter (Welle III, an F11 angeglichen): Als Template gilt die im Code
 * persistierte **Standard-Vorlage des `detailViewType`** (z.B. `standard-book`),
 * NICHT der docType. So nutzt die Inbox-Analyse dieselbe Builtin-Default-Vorlage
 * wie die Archiv-Pipeline (`pickTemplate`/`getDefaultTemplateNameForViewType`).
 * Ingest bleibt deaktiviert (phases + policy). Medienspezifische Optionen
 * (OCR-Flags bei PDF, Quellsprache bei Audio) kommen aus `buildAnalysisMediaOptions`.
 */
export function buildSubmissionAnalysisParameters(
  submission: WizardSubmission,
  media: AnalyzableMedia,
): Record<string, unknown> {
  return {
    ...SUBMISSION_ANALYSIS_DEFAULTS,
    ...buildAnalysisMediaOptions(media.jobType),
    template: getDefaultTemplateNameForViewType(submission.detailViewType),
    phases: { extract: true, template: true, ingest: false },
    policies: { extract: 'do', metadata: 'do', ingest: 'ignore' },
  };
}

/** Baut das ExternalJob-Dokument (status 'queued'; der Worker dispatcht). */
export function buildSubmissionAnalysisJob(args: BuildSubmissionAnalysisJobArgs): ExternalJob {
  const { submission, source, parentId, userEmail, jobId, jobSecretHash } = args;
  const { ref, media } = source;
  const now = new Date();
  return {
    jobId,
    jobSecretHash,
    job_type: media.jobType,
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
        mediaType: media.mediaType,
        mimeType: ref.contentType,
        name: ref.fileName,
        itemId: ref.itemId,
        parentId,
      },
      options: {
        targetLanguage: SUBMISSION_ANALYSIS_DEFAULTS.targetLanguage,
        ...buildAnalysisMediaOptions(media.jobType),
        // Korrelations-Anker fuer den Ergebnis-Rueckfluss (submission-analysis.ts).
        submissionId: submission.id,
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}
