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

import type { StorageItem } from '@/lib/storage/types';
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose';
import { buildPublishFrontmatter } from '@/lib/submissions/publish-frontmatter';
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug';
import type { WizardSubmission } from '@/types/wizard-submission';
import { copyOriginalsToTarget, promoteTranscriptOnly } from '@/lib/submissions/promotion-transcript';
import type {
  PromoteSubmissionArgs,
  PromotionProvider,
  PromotionResult,
  ResolvedTargetFolder,
} from '@/lib/submissions/promotion-types';

// Vertraege der Publikation liegen in `promotion-types.ts` (200-Zeilen-Grenze);
// hier re-exportiert, damit die Import-Oberflaeche (Routes/Tests) stabil bleibt.
export type {
  PromotionProvider,
  UpsertMarkdownFn,
  LoadOriginalFn,
  WriteTranscriptArtifactArgs,
  WriteTranscriptArtifactFn,
  MirrorAssetsArgs,
  MirrorAssetsFn,
  PromoteSubmissionArgs,
  PromotionResult,
  ResolvedTargetFolder,
} from '@/lib/submissions/promotion-types';

/**
 * Name des Standard-Zielordners unter Root, wenn der Erfasser kein Ziel gewaehlt
 * hat. Bewusste, dokumentierte Voreinstellung (kein stiller Fallback): „kein
 * Ordner gewaehlt" wird explizit auf `root/inbox` abgebildet, damit der Root
 * nicht zugespammt wird (siehe docs/analysis/wizard-publish-zielordner-default-inbox.md).
 * NICHT zu verwechseln mit der Quarantaene-Inbox (Azure Blob, ADR-0004) — das ist
 * ein normaler Ablage-Ordner IN der Ziel-Library NACH der Publikation.
 */
export const DEFAULT_PUBLISH_FOLDER_NAME = 'inbox';

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
  // Explizit gewaehlter Ordner: ID steht fest. Den Anzeigenamen via optionalem
  // `getItemById` aufloesen (nur Anzeige), damit die Summary keinen kryptischen
  // fileId-Rohwert zeigt. Schlaegt der Lookup fehl / fehlt die Methode, bleibt der
  // Name `undefined` — die UI faellt dann bewusst auf die ID zurueck (kein
  // stiller Default-Name).
  if (explicitFolderId) {
    if (provider.getItemById) {
      try {
        const folder = await provider.getItemById(explicitFolderId);
        const name = folder?.metadata?.name;
        if (typeof name === 'string' && name.trim().length > 0) {
          return { id: explicitFolderId, name };
        }
      } catch {
        // Name-Lookup ist rein kosmetisch — ein Fehler darf die Publikation nicht
        // stoppen. Ohne Name faellt die UI auf die ID zurueck (dokumentiert).
      }
    }
    return { id: explicitFolderId };
  }
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
  const { submission, provider, upsertMarkdown, userEmail, loadOriginal, writeTranscriptArtifact, mirrorAssets } = args;

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
      mirrorAssets,
    });
  }

  // Normalfall (Dokumententyp): Standalone-Markdown + RAG-Ingest (heutiges Verhalten).
  const fileName = resolvePublishFileName(submission);
  // Variante A: System-Felder (docType/detailViewType) deterministisch ins
  // Frontmatter erzwingen. Sie liegen als validierte Top-Level-Felder vor; das
  // Frontmatter entstand aber bisher nur aus `submission.metadata`, wodurch
  // hardcodierte Felder wie `detailViewType` verloren gingen (Event -> "book").
  const frontmatter = buildPublishFrontmatter({
    metadata: submission.metadata,
    docType: submission.docType,
    detailViewType: submission.detailViewType,
  });
  const markdown = createMarkdownWithFrontmatter(submission.markdownBody, frontmatter);
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
  // daher auch bei Wiederholung sicher. Dieselbe (um System-Felder angereicherte)
  // Meta wie im Frontmatter -> docMetaJson bleibt konsistent zur Datei.
  await upsertMarkdown(userEmail, submission.libraryId, savedItemId, fileName, markdown, frontmatter);

  return {
    savedItemId,
    fileName,
    alreadyPresent: Boolean(existing),
    targetFolderId: folderId,
    targetFolderName: targetFolder.name,
    copiedOriginalNames: copiedNames,
  };
}

