/**
 * @fileoverview Promotion-Helfer fuer den transcript-only-Pfad (Befund B2a).
 *
 * @description
 * Ausgelagerte reine Helfer von `promotion.ts` (200-Zeilen-Grenze):
 * - `copyOriginalsToTarget`: kopiert hochgeladene Originale aus der Inbox ins Ziel
 *   (B1) und liefert eine Map (Dateiname -> Ziel-Item) fuer den Traeger-Lookup.
 * - `promoteTranscriptOnly`: legt das Transkript als Shadow-Twin der Ziel-Quelle
 *   ab (kein Standalone-Dokument, kein RAG-Ingest) — der „Nur importieren und
 *   transkribieren"-Ausnahmefall (nur Extract-Schritt eines External Jobs).
 *
 * Storage-agnostisch: Das tatsaechliche Schreiben (Filesystem-Dot-Folder vs.
 * Mongo) injiziert der Aufrufer als `WriteTranscriptArtifactFn`.
 *
 * @see docs/analysis/wizard-promotion-shadow-twin-angleichung.md
 * @module lib/submissions
 */

import type { StorageItem } from '@/lib/storage/types';
import type { WizardSubmission } from '@/types/wizard-submission';
import type {
  LoadOriginalFn,
  PromotionProvider,
  PromotionResult,
  ResolvedTargetFolder,
  WriteTranscriptArtifactFn,
} from '@/lib/submissions/promotion';

/**
 * Zielsprache des Transkripts. Bewusst fixer Default `de` (analog
 * `SUBMISSION_ANALYSIS_DEFAULTS`); eine waehlbare Sprache ist eine spaetere
 * Scheibe — dokumentiert, kein stiller Fallback.
 */
const TRANSCRIPT_DEFAULT_LANGUAGE = 'de';

/**
 * Kopiert die in der Submission referenzierten Original-Binaries aus der Inbox
 * in den Ziel-Ordner. Idempotent: bereits gleichnamig vorhandene Dateien werden
 * uebersprungen (auch mehrfach derselbe Name innerhalb eines Laufs). Liefert die
 * kopierten Namen UND eine Map (Dateiname -> Ziel-Item) inkl. bereits vorhandener
 * Dateien, damit der Transkript-Pfad den Traeger (Original) referenzieren kann.
 * Ohne `loadOriginal` (z.B. Text-/URL-Submission) werden nur vorhandene Items
 * gemappt.
 */
export async function copyOriginalsToTarget(args: {
  provider: PromotionProvider;
  folderId: string;
  submission: WizardSubmission;
  loadOriginal?: LoadOriginalFn;
  existingItems: StorageItem[];
}): Promise<{ copiedNames: string[]; targetItems: Map<string, StorageItem> }> {
  const { provider, folderId, submission, loadOriginal, existingItems } = args;

  // Bereits im Ziel vorhandene Dateien (Idempotenz + Traeger-Lookup).
  const targetItems = new Map<string, StorageItem>();
  for (const it of existingItems) {
    const name = it.type === 'file' ? it.metadata?.name : undefined;
    if (typeof name === 'string') targetItems.set(name, it);
  }

  const copiedNames: string[] = [];
  if (!loadOriginal || submission.binaryRefs.length === 0) {
    return { copiedNames, targetItems };
  }

  for (const ref of submission.binaryRefs) {
    if (targetItems.has(ref.fileName)) continue;
    const blob = await loadOriginal(ref);
    const file = new File([blob], ref.fileName, { type: ref.contentType });
    const uploaded = await provider.uploadFile(folderId, file);
    targetItems.set(ref.fileName, uploaded);
    copiedNames.push(ref.fileName);
  }
  return { copiedNames, targetItems };
}

/**
 * Transcript-only-Pfad: legt das Transkript als Shadow-Twin der Ziel-Quelle ab
 * (Traeger = kopiertes Original). Kein Standalone-Dokument, kein RAG-Ingest.
 * Wirft bei fehlender Schreib-Funktion, fehlender Quelle oder leerem Transkript
 * (kein stiller Teilzustand).
 */
export async function promoteTranscriptOnly(args: {
  submission: WizardSubmission;
  folderId: string;
  targetFolder: ResolvedTargetFolder;
  targetItems: Map<string, StorageItem>;
  copiedNames: string[];
  writeTranscriptArtifact?: WriteTranscriptArtifactFn;
}): Promise<PromotionResult> {
  const { submission, folderId, targetFolder, targetItems, copiedNames, writeTranscriptArtifact } = args;

  if (!writeTranscriptArtifact) {
    throw new Error('Transcript-Promotion: writeTranscriptArtifact-Abhaengigkeit fehlt');
  }
  // Traeger = erste Binaerquelle (die analysierte Datei). Ihr kopiertes Ziel-Item
  // ist der Shadow-Twin-Anker (stabile fileId, kein spaeterer Move).
  const carrierRef = submission.binaryRefs[0];
  if (!carrierRef) {
    throw new Error('Transcript-Promotion: keine Binaerquelle (binaryRefs leer)');
  }
  const carrier = targetItems.get(carrierRef.fileName);
  if (!carrier) {
    throw new Error(`Transcript-Promotion: Original im Ziel nicht gefunden: ${carrierRef.fileName}`);
  }
  const transcript = submission.markdownBody;
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    throw new Error('Transcript-Promotion: leeres Transkript (markdownBody)');
  }

  const artifact = await writeTranscriptArtifact({
    sourceId: carrier.id,
    sourceName: carrierRef.fileName,
    parentId: folderId,
    markdown: transcript,
    targetLanguage: TRANSCRIPT_DEFAULT_LANGUAGE,
  });

  return {
    savedItemId: artifact.artifactId,
    fileName: artifact.artifactName,
    alreadyPresent: !copiedNames.includes(carrierRef.fileName),
    targetFolderId: folderId,
    targetFolderName: targetFolder.name,
    copiedOriginalNames: copiedNames,
  };
}
