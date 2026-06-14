/**
 * @fileoverview Reine Publikations-Logik: Submission -> Ziel-Provider + RAG (ADR-0004 §E3).
 *
 * @description
 * Schreibt den abgenommenen Markdown einer Submission in den Ziel-Ordner des
 * Providers und nimmt ihn in den RAG-Index auf. Provider und Ingestion werden
 * INJIZIERT (testbar mit Fakes); diese Datei kennt weder Auth noch die Status-
 * Maschine - das ist Sache der Route/Action. Idempotent: existiert die Ziel-
 * Datei schon (Wiederholung nach Abbruch), wird sie NICHT dupliziert; der RAG-
 * Index wird trotzdem sicher (neu) aufgebaut (die Ingestion loescht alte
 * Vektoren je `fileId` zuerst). Kein Silent Fallback: fehlt das Ziel
 * (`target.folderId`), bricht die Publikation klar ab.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md (§E3)
 * @module lib/submissions
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types';
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose';
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug';
import { PromotionTargetMissingError } from '@/lib/submissions/promotion-errors';
import type { WizardSubmission } from '@/types/wizard-submission';

/** Schmaler Provider-Ausschnitt, den die Publikation braucht (vereinfacht Fakes). */
export type PromotionProvider = Pick<StorageProvider, 'listItemsById' | 'uploadFile'>;

/**
 * Ingestion-Funktion (injiziert). Entspricht den Pflicht-Parametern von
 * `IngestionService.upsertMarkdown` - die weiteren Parameter (jobId, provider,
 * ...) bleiben hier bewusst aussen vor.
 */
export type UpsertMarkdownFn = (
  userEmail: string,
  libraryId: string,
  fileId: string,
  fileName: string,
  markdown: string,
  meta?: Record<string, unknown>,
) => Promise<unknown>;

/** Eingabe fuer `promoteSubmission`. */
export interface PromoteSubmissionArgs {
  submission: WizardSubmission;
  provider: PromotionProvider;
  upsertMarkdown: UpsertMarkdownFn;
  /** Akteur (normalisierte E-Mail) - fuer die Ingestion-Zuordnung. */
  userEmail: string;
}

/** Ergebnis einer Publikation. */
export interface PromotionResult {
  /** ID der geschriebenen Markdown-Datei im Ziel-Provider. */
  savedItemId: string;
  /** Dateiname im Ziel (z.B. `mein-titel.md`). */
  fileName: string;
  /** War die Datei schon vorhanden (Idempotenz-Wiederholung)? */
  alreadyPresent: boolean;
}

/**
 * Leitet den Ziel-Dateinamen deterministisch aus Slug/Titel/ID ab. Kein stiller
 * Datenverlust: die explizite Reihenfolge (target.slug -> metadata.title -> id)
 * ist dokumentiert und reproduzierbar.
 */
function resolvePublishFileName(submission: WizardSubmission): string {
  const title = typeof submission.metadata.title === 'string' ? submission.metadata.title : undefined;
  const slug = buildDocumentSlugFallback(submission.target.slug, title, submission.id);
  return `${slug}.md`;
}

/** Sucht eine bereits vorhandene Ziel-Datei gleichen Namens (Idempotenz). */
function findExistingFile(items: StorageItem[], fileName: string): StorageItem | undefined {
  return items.find((it) => it.type === 'file' && it.metadata?.name === fileName);
}

/**
 * Publiziert eine Submission: Markdown in den Ziel-Ordner schreiben + RAG-Index
 * aktualisieren. Reine Orchestrierung ueber die injizierten Abhaengigkeiten -
 * jeder Wurf bleibt unbehandelt, damit die Action ihn klassifizieren kann
 * (Token/Speicher -> Ruecksprung auf `ready`).
 */
export async function promoteSubmission(args: PromoteSubmissionArgs): Promise<PromotionResult> {
  const { submission, provider, upsertMarkdown, userEmail } = args;

  const folderId = submission.target.folderId;
  if (!folderId) throw new PromotionTargetMissingError(submission.id);

  const fileName = resolvePublishFileName(submission);
  const markdown = createMarkdownWithFrontmatter(submission.markdownBody, submission.metadata);

  // Idempotenz: bereits geschriebene Datei wiederverwenden statt duplizieren.
  const existing = findExistingFile(await provider.listItemsById(folderId), fileName);
  let savedItemId: string;
  if (existing) {
    savedItemId = existing.id;
  } else {
    const file = new File([markdown], fileName, { type: 'text/markdown' });
    const uploaded = await provider.uploadFile(folderId, file);
    savedItemId = uploaded.id;
  }

  // RAG-Ingestion ist selbst idempotent (loescht alte Vektoren je fileId zuerst),
  // daher auch bei Wiederholung sicher.
  await upsertMarkdown(userEmail, submission.libraryId, savedItemId, fileName, markdown, submission.metadata);

  return { savedItemId, fileName, alreadyPresent: Boolean(existing) };
}
