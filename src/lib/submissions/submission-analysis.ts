/**
 * @fileoverview Ergebnis-Rueckfluss: Analyse-Job -> Submission (Welle III).
 *
 * @description
 * Wenn ein Inbox-Analyse-Job (siehe submission-analysis-job.ts) abschliesst,
 * fliesst das transformierte Markdown in die korrelierte Submission zurueck:
 * Frontmatter -> `metadata` (gemergt ueber die Stufe-A-Platzhalter; Analyse
 * gewinnt je Feld), Body -> `markdownBody`. Wirft bei jedem Problem (Artefakt
 * leer, Submission fehlt/nicht editierbar) — der Aufrufer (setJobCompleted)
 * laesst den Job dann NICHT als completed durchgehen (Retry statt stillem
 * Teilzustand). Confidence-Mapping ist eine spaetere Scheibe.
 *
 * @see docs/wizards/contributor-pdf-upload-wizard.md (Stufe B)
 * @module lib/submissions
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import {
  getSubmissionById,
  updateSubmissionMetadata,
} from '@/lib/repositories/wizard-submissions-repo';
import type { StorageProvider } from '@/lib/storage/types';
import type { ExternalJob } from '@/types/external-job';
import type { WizardSubmission } from '@/types/wizard-submission';

/**
 * Liest die korrelierte Submission-ID aus dem Job (correlation.options.submissionId).
 * `null`, wenn der Job keine Submission-Analyse ist (normaler Archiv-Job).
 */
export function extractSubmissionIdFromJob(job: Pick<ExternalJob, 'correlation'>): string | null {
  const raw = (job.correlation?.options as { submissionId?: unknown } | undefined)?.submissionId;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

export interface ApplyAnalysisResultArgs {
  submissionId: string;
  /** Transform-Artefakt (savedItemId aus dem Completion-Contract). */
  savedItemId: string;
  /** Provider des Jobs (Inbox-Provider bei providerScope='inbox'). */
  provider: StorageProvider;
}

/**
 * Laedt das Artefakt ueber den Provider, parst Frontmatter+Body und schreibt
 * beides in die Submission. Wirft bei leerem Ergebnis oder fehlender/nicht
 * editierbarer Submission (kein stiller Fallback).
 */
export async function applyAnalysisResult(args: ApplyAnalysisResultArgs): Promise<WizardSubmission> {
  const { submissionId, savedItemId, provider } = args;

  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    throw new Error(`applyAnalysisResult: Submission nicht gefunden: ${submissionId}`);
  }

  const binary = await provider.getBinary(savedItemId);
  const markdown = await binary.blob.text();
  const { meta, body } = parseFrontmatter(markdown);

  const trimmedBody = body.trim();
  if (Object.keys(meta).length === 0 && trimmedBody.length === 0) {
    throw new Error(
      `applyAnalysisResult: Transform-Artefakt ist leer (weder Frontmatter noch Body): ${savedItemId}`,
    );
  }

  // Merge: Stufe-A-Platzhalter (z.B. title=Dateiname) bleiben erhalten,
  // Analyse-Felder gewinnen je Schluessel.
  const metadata = { ...submission.metadata, ...meta };

  // updateSubmissionMetadata wirft bei nicht editierbarem Status (z.B. bereits
  // freigegeben) — gewollt: der Job soll dann laut fehlschlagen.
  return updateSubmissionMetadata(submissionId, { metadata, markdownBody: body });
}
