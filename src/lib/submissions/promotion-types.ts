/**
 * @fileoverview Typen/Verträge der Publikations-Logik (ADR-0004 §E3).
 *
 * @description
 * Ausgelagerte Typen von `promotion.ts` (200-Zeilen-Grenze): die injizierten
 * Funktions-Signaturen (Ingestion, Original-Loader, Transkript-Twin, Asset-
 * Spiegelung) sowie Ein-/Ausgabe-Formen von `promoteSubmission`. Reine Typen,
 * keine Laufzeit-Logik. `promotion.ts` re-exportiert sie, damit die Import-
 * Oberflaeche stabil bleibt.
 *
 * @module lib/submissions
 */

import type { StorageProvider } from '@/lib/storage/types';
import type { SubmissionBinaryRef, WizardSubmission } from '@/types/wizard-submission';

/**
 * Schmaler Provider-Ausschnitt, den die Publikation braucht (vereinfacht Fakes).
 * `getItemById` ist OPTIONAL: nur fuer die Anzeige des Ordnernamens bei einem
 * explizit gewaehlten Zielordner. Fehlt es (z.B. in schlanken Test-Fakes), faellt
 * die UI ohne stillen Default auf die ID zurueck.
 */
export type PromotionProvider = Pick<StorageProvider, 'listItemsById' | 'uploadFile' | 'createFolder'>
  & Partial<Pick<StorageProvider, 'getItemById'>>;

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

/** Eingabe fuer das Spiegeln der Extract-Assets ins Ziel-Archiv (Befund B2d). */
export interface MirrorAssetsArgs {
  /** Inbox-Quelle (Original) — `itemId`/`fileName` fuer die Inbox-Shadow-Twin-Suche. */
  sourceRef: SubmissionBinaryRef;
  /** fileId des kopierten Originals im Ziel (Shadow-Twin-Anker fuer die Assets). */
  targetSourceId: string;
  /** Eltern-Ordner der Ziel-Quelle im Ziel-Provider. */
  parentId: string;
}

/**
 * Spiegelt die beim Extract erzeugten Bilder/Assets aus der Inbox-Quarantaene ins
 * Ziel-Archiv (injiziert). Die FS/Mongo-Ablage entscheidet der Aufrufer ueber den
 * Ziel-`ShadowTwinService` — `promotion.ts` bleibt storage-agnostisch. Liefert die
 * tatsaechlich gespiegelten Asset-Namen (idempotent: bereits vorhandene fehlen).
 */
export type MirrorAssetsFn = (args: MirrorAssetsArgs) => Promise<{ mirroredNames: string[] }>;

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
  /**
   * Optional (nur Transkript-Pfad): spiegelt die Extract-Assets (Bilder) aus der
   * Inbox ins Ziel-Archiv. Additive Anreicherung — fehlt sie, werden keine Assets
   * gespiegelt (Original + Transkript bleiben unberuehrt).
   */
  mirrorAssets?: MirrorAssetsFn;
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
   * Namen der ins Ziel gespiegelten Extract-Assets (Bilder), nur im Transkript-
   * Pfad gesetzt. Leer, wenn keine Assets vorhanden/gespiegelt wurden (Befund B2d).
   */
  mirroredAssetNames?: string[];
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
