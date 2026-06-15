/**
 * @fileoverview Analyse-Medien-Weiche: contentType -> Pipeline-Parameter (U5b).
 *
 * @description
 * Reine Abbildung des MIME-Typs einer Submission-Binaerquelle auf die
 * Pipeline-Parameter, die die external-jobs-Inbox-Analyse braucht: `job_type`,
 * der erste Extract-Step (gespiegelt aus `extract-only.ts`) und die
 * medienspezifischen `correlation.options` (die `secretary-request.ts` je
 * job_type liest). Damit wird die bisher PDF-harte Analyse-Job-Fabrik
 * medien-agnostisch (U5: Compute off-target fuer alle Medien).
 *
 * Unterstuetzt heute **PDF** und **Audio** (U5-Scope: PDF/Audio-Dateien). Andere
 * Typen liefern `null` -> der Aufrufer wirft mit klarer Ursache statt still aufs
 * PDF zu defaulten (no-silent-fallbacks).
 *
 * @see src/lib/external-jobs/secretary-request.ts (liest correlation.options je job_type)
 * @see src/lib/external-jobs/extract-only.ts (job_type -> Extract-Step)
 * @module lib/submissions
 */

/** Von der Inbox-Analyse unterstuetzte Job-Typen (U5-Scope). */
export type AnalyzableJobType = 'pdf' | 'audio';

/** Aufgeloeste Pipeline-Identitaet einer analysierbaren Binaerquelle. */
export interface AnalyzableMedia {
  /** External-Job `job_type` (steuert Secretary-Endpoint + Extract-Step). */
  jobType: AnalyzableJobType;
  /** `correlation.source.mediaType` (deskriptiv). */
  mediaType: string;
  /** Erster Pipeline-Step (muss zu `extract-only.ts` passen). */
  extractStepName: 'extract_pdf' | 'extract_audio';
}

/**
 * Bildet einen MIME-Typ auf die Analyse-Medien-Parameter ab. `null` bei nicht
 * unterstuetztem Typ — der Aufrufer entscheidet ueber den Fehler (kein stiller
 * PDF-Fallback).
 */
export function resolveAnalyzableMedia(contentType: string): AnalyzableMedia | null {
  const ct = contentType.trim().toLowerCase();
  if (ct === 'application/pdf') {
    return { jobType: 'pdf', mediaType: 'pdf', extractStepName: 'extract_pdf' };
  }
  if (ct.startsWith('audio/')) {
    return { jobType: 'audio', mediaType: 'audio', extractStepName: 'extract_audio' };
  }
  return null;
}

/**
 * Medienspezifische `correlation.options`, die `secretary-request.ts` je
 * `job_type` liest. PDF nutzt Mistral-OCR + Bild-Flags; Audio nur die
 * Quellsprache (Zielsprache ist medien-agnostisch und liegt im Aufrufer).
 * Wirft bei unbehandeltem job_type (no-silent-fallbacks).
 */
export function buildAnalysisMediaOptions(jobType: AnalyzableJobType): Record<string, unknown> {
  if (jobType === 'pdf') {
    return {
      extractionMethod: 'mistral_ocr',
      includeOcrImages: true,
      includePreviewPages: true,
      includeHighResPages: true,
    };
  }
  if (jobType === 'audio') {
    return { sourceLanguage: 'auto' };
  }
  throw new Error(`buildAnalysisMediaOptions: unbehandelter jobType "${String(jobType)}"`);
}
