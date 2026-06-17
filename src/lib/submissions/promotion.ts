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
 * Vektoren je `fileId` zuerst). Hat der Erfasser kein Ziel gewaehlt
 * (`target.folderId` leer), wird der Standard-Ordner `root/inbox` verwendet
 * (find-or-create) — dokumentierte Voreinstellung, kein Root-Spam.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md (§E3)
 * @module lib/submissions
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types';
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose';
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug';
import type { SubmissionBinaryRef, WizardSubmission } from '@/types/wizard-submission';
import { copyOriginalsToTarget, promoteTranscriptOnly } from '@/lib/submissions/promotion-transcript';

/**
 * Name des Standard-Zielordners unter Root, wenn der Erfasser kein Ziel gewaehlt
 * hat. Bewusste, dokumentierte Voreinstellung (kein stiller Fallback): „kein
 * Ordner gewaehlt" wird explizit auf `root/inbox` abgebildet, damit der Root
 * nicht zugespammt wird (siehe docs/analysis/wizard-publish-zielordner-default-inbox.md).
 * NICHT zu verwechseln mit der Quarantaene-Inbox (Azure Blob, ADR-0004) — das ist
 * ein normaler Ablage-Ordner IN der Ziel-Library NACH der Publikation.
 */
export const DEFAULT_PUBLISH_FOLDER_NAME = 'inbox';

/** Schmaler Provider-Ausschnitt, den die Publikation braucht (vereinfacht Fakes). */
export type PromotionProvider = Pick<StorageProvider, 'listItemsById' | 'uploadFile' | 'createFolder'>;

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

/**
 * Laedt das Original-Binary einer Inbox-Quelle (injiziert; liest aus dem
 * Inbox-Provider). Wird genutzt, um das hochgeladene Original (z.B. PDF) beim
 * Publizieren zusaetzlich in den Ziel-Ordner zu kopieren (Befund B). Fehlt die
 * Funktion, wird kein Original kopiert (z.B. Text-/URL-Submissions ohne Binaer).
 */
export type LoadOriginalFn = (ref: SubmissionBinaryRef) => Promise<Blob>;

/** Eingabe fuer das Schreiben eines Transkript-Shadow-Twins der Ziel-Quelle. */
export interface WriteTranscriptArtifactArgs {
  /** fileId der Ziel-Quelle (kopiertes Original, z.B. PDF) - Shadow-Twin-Anker. */
  sourceId: string;
  /** Dateiname der Ziel-Quelle (z.B. `godaddy_peter2.pdf`). */
  sourceName: string;
  /** Eltern-Ordner der Quelle im Ziel-Provider. */
  parentId: string;
  /** Transkript-Inhalt (reiner Body, ohne Frontmatter). */
  markdown: string;
  /** Zielsprache des Transkripts (z.B. `de`). */
  targetLanguage: string;
}

/**
 * Schreibt das Transkript als Shadow-Twin der Ziel-Quelle (injiziert). Die
 * konkrete Ablage (Filesystem-Dot-Folder via `writeArtifact` vs. Mongo via
 * `ShadowTwinService`) entscheidet der Aufrufer anhand der Library-Config —
 * `promotion.ts` bleibt storage-agnostisch.
 */
export type WriteTranscriptArtifactFn = (
  args: WriteTranscriptArtifactArgs,
) => Promise<{ artifactId: string; artifactName: string }>;

/** Eingabe fuer `promoteSubmission`. */
export interface PromoteSubmissionArgs {
  submission: WizardSubmission;
  provider: PromotionProvider;
  upsertMarkdown: UpsertMarkdownFn;
  /** Akteur (normalisierte E-Mail) - fuer die Ingestion-Zuordnung. */
  userEmail: string;
  /**
   * Optional: laedt Original-Binaries aus der Inbox, damit sie zusaetzlich zum
   * generierten Markdown in den Ziel-Ordner kopiert werden (Original im Archiv).
   */
  loadOriginal?: LoadOriginalFn;
  /**
   * Optional (PFLICHT fuer `docType==='transcript'`): schreibt das Transkript als
   * Shadow-Twin der Ziel-Quelle. Fehlt sie im Transkript-Pfad, wird laut geworfen.
   */
  writeTranscriptArtifact?: WriteTranscriptArtifactFn;
}

/** Ergebnis einer Publikation. */
export interface PromotionResult {
  /** ID der geschriebenen Markdown-Datei im Ziel-Provider. */
  savedItemId: string;
  /** Dateiname im Ziel (z.B. `mein-titel.md`). */
  fileName: string;
  /** War die Datei schon vorhanden (Idempotenz-Wiederholung)? */
  alreadyPresent: boolean;
  /** ID des tatsaechlich genutzten Zielordners (explizit gewaehlt oder `root/inbox`). */
  targetFolderId: string;
  /**
   * Anzeigename des Zielordners (z.B. `inbox`). Nur bekannt, wenn der Ordner hier
   * gefunden/angelegt wurde (Default-Pfad). Bei explizit uebergebener `folderId`
   * (Owner-Ordner-Picker, noch nicht aktiv) bleibt der Name `undefined` — die UI
   * faellt dann auf die ID zurueck, ohne stillen Default.
   */
  targetFolderName?: string;
  /**
   * Namen der zusaetzlich aus der Inbox in den Ziel-Ordner kopierten Originale
   * (z.B. `Invoice.pdf`). Leer, wenn kein Original vorhanden/kopiert wurde.
   */
  copiedOriginalNames: string[];
}

/** Aufgeloester Zielordner: ID immer, Anzeigename nur im Default-Pfad bekannt. */
export interface ResolvedTargetFolder {
  id: string;
  name?: string;
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
 * Loest den Zielordner auf: hat der Erfasser explizit einen Ordner gewaehlt
 * (`target.folderId`), wird dieser genommen. Sonst wird der Standard-Ordner
 * `root/inbox` verwendet — find-or-create, storage-agnostisch ueber das
 * Provider-Interface. So muss spaeter NICHTS verschoben werden, die `fileId`
 * bleibt stabil (wichtig fuer Filesystem/Nextcloud, deren IDs am Pfad haengen).
 */
async function resolveTargetFolder(
  provider: PromotionProvider,
  explicitFolderId: string | undefined,
): Promise<ResolvedTargetFolder> {
  // Explizit gewaehlter Ordner: ID steht fest, Name ist hier nicht bekannt
  // (kein zusaetzlicher Lookup ueber den schmalen Provider) — UI faellt auf ID.
  if (explicitFolderId) return { id: explicitFolderId };
  const rootItems = await provider.listItemsById('root');
  const existing = rootItems.find(
    (it) => it.type === 'folder' && it.metadata?.name === DEFAULT_PUBLISH_FOLDER_NAME,
  );
  if (existing) return { id: existing.id, name: existing.metadata?.name };
  const created = await provider.createFolder('root', DEFAULT_PUBLISH_FOLDER_NAME);
  // Hinweis: Manche Backends (z.B. OneDrive) benennen bei Namenskollision um
  // (`inbox` -> `inbox 1`). Wir geben den TATSAECHLICHEN Namen zurueck, damit die
  // Summary den realen Ordner zeigt (kein beschoenigter Default).
  return { id: created.id, name: created.metadata?.name };
}

/**
 * Publiziert eine Submission: Markdown in den Ziel-Ordner schreiben + RAG-Index
 * aktualisieren. Reine Orchestrierung ueber die injizierten Abhaengigkeiten -
 * jeder Wurf bleibt unbehandelt, damit die Action ihn klassifizieren kann
 * (Token/Speicher -> Ruecksprung auf `ready`).
 */
export async function promoteSubmission(args: PromoteSubmissionArgs): Promise<PromotionResult> {
  const { submission, provider, upsertMarkdown, userEmail, loadOriginal, writeTranscriptArtifact } = args;

  // Kein Ziel gewaehlt -> Standard-Ordner `root/inbox` (find-or-create), statt in
  // den Root zu schreiben. Explizit gewaehltes `folderId` bleibt unveraendert.
  const targetFolder = await resolveTargetFolder(provider, submission.target.folderId);
  const folderId = targetFolder.id;

  // Ordner-Inhalt EINMAL lesen — fuer Markdown-Idempotenz und das Original-Kopieren.
  const folderItems = await provider.listItemsById(folderId);

  // B1: hochgeladenes Original (z.B. PDF) ins Ziel kopieren (beide Pfade).
  const { copiedNames, targetItems } = await copyOriginalsToTarget({
    provider,
    folderId,
    submission,
    loadOriginal,
    existingItems: folderItems,
  });

  // Ausnahmefall „Nur importieren und transkribieren" (docType='transcript'):
  // NUR Extract — Original + Transkript-Shadow-Twin der Quelle. Keine
  // Transformation, keine Publikation, kein RAG-Ingest.
  if (submission.docType === 'transcript') {
    return promoteTranscriptOnly({
      submission,
      folderId,
      targetFolder,
      targetItems,
      copiedNames,
      writeTranscriptArtifact,
    });
  }

  // Normalfall (Dokumententyp): Standalone-Markdown + RAG-Ingest (heutiges Verhalten).
  const fileName = resolvePublishFileName(submission);
  const markdown = createMarkdownWithFrontmatter(submission.markdownBody, submission.metadata);
  const existing = findExistingFile(folderItems, fileName);
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

  return {
    savedItemId,
    fileName,
    alreadyPresent: Boolean(existing),
    targetFolderId: folderId,
    targetFolderName: targetFolder.name,
    copiedOriginalNames: copiedNames,
  };
}

