/**
 * @fileoverview Zentrale Medientyp-Definitionen
 * 
 * @description
 * Konsolidierte Medientyp-Definitionen für das gesamte Projekt.
 * Ersetzt die verteilten Definitionen in:
 * - src/lib/pipeline/run-pipeline.ts (MediaKind)
 * - src/atoms/transcription-options.ts (MediaType)
 * - src/components/library/shared/story-status.ts (StoryMediaType)
 * - Lokale Kopien in diversen Komponenten
 * 
 * @module media-types
 */

import type { StorageItem } from "@/lib/storage/types"

// =============================================================================
// ZENTRALE TYPEN
// =============================================================================

/**
 * Technischer Medientyp - verwendet für:
 * - Pipeline-Orchestrierung (welcher Endpoint wird aufgerufen)
 * - UI-Rendering (wie wird die Datei angezeigt)
 * - Story-Status-Labels
 */
export type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

/**
 * Job-Typ für Backend-Verarbeitung
 * Mapping: MediaKind → JobType
 */
export type JobType = "pdf" | "audio" | "video" | "text"

/**
 * UI-Kategorie für Dateilisten-Filterung
 * Mapping: MediaKind → FileCategory
 */
export type FileCategory = "all" | "media" | "text" | "documents"

// =============================================================================
// ERKENNUNGSFUNKTION
// =============================================================================

/**
 * Bestimmt den Medientyp einer Datei basierend auf Name und MIME-Type
 * 
 * @param file - StorageItem mit metadata.name und metadata.mimeType
 * @returns MediaKind - Der erkannte Medientyp
 * 
 * @example
 * const kind = getMediaKind(file)
 * if (kind === "pdf") { ... }
 */
export function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  // PDF-Dateien
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  
  // Audio-Dateien
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  
  // Video-Dateien
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  
  // Bild-Dateien
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  
  // Markdown/Text-Dateien
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  
  return "unknown"
}

// =============================================================================
// MAPPING-FUNKTIONEN
// =============================================================================

/**
 * Konvertiert MediaKind zu JobType für Backend-Verarbeitung
 * 
 * @param kind - Der MediaKind der Datei
 * @returns JobType - Der entsprechende Job-Typ
 * 
 * @example
 * const jobType = mediaKindToJobType("markdown") // => "text"
 */
export function mediaKindToJobType(kind: MediaKind): JobType {
  switch (kind) {
    case "pdf":
      return "pdf"
    case "audio":
      return "audio"
    case "video":
      return "video"
    case "markdown":
    case "image":
    case "unknown":
    default:
      return "text"
  }
}

/**
 * Konvertiert MediaKind zu FileCategory für UI-Filterung
 * 
 * @param kind - Der MediaKind der Datei
 * @returns FileCategory - Die entsprechende UI-Kategorie
 * 
 * @example
 * const category = mediaKindToFileCategory("audio") // => "media"
 */
export function mediaKindToFileCategory(kind: MediaKind): FileCategory {
  switch (kind) {
    case "audio":
    case "video":
      return "media"
    case "markdown":
      return "text"
    case "pdf":
    case "image":
      return "documents"
    case "unknown":
    default:
      return "all"
  }
}

/**
 * Prüft, ob ein MediaKind von der Pipeline unterstützt wird
 * 
 * @param kind - Der MediaKind der Datei
 * @returns boolean - true wenn verarbeitbar
 */
export function isPipelineSupported(kind: MediaKind): boolean {
  return kind === "pdf" || kind === "audio" || kind === "video" || kind === "markdown"
}

/**
 * Gibt das passende Label für den Text-Schritt basierend auf MediaKind zurück
 * 
 * @param kind - Der MediaKind der Datei
 * @returns string - Das Label für den Text-Schritt
 * 
 * @example
 * getTextStepLabel("audio") // => "Transkription"
 * getTextStepLabel("pdf")   // => "Text (OCR/Extrakt)"
 */
export function getTextStepLabel(kind: MediaKind): string {
  switch (kind) {
    case "audio":
    case "video":
      return "Transkription"
    case "pdf":
    case "image":
      return "Text (OCR/Extrakt)"
    default:
      return "Text"
  }
}

// =============================================================================
// LEGACY-KOMPATIBILITÄT
// =============================================================================

/**
 * @deprecated Verwende stattdessen MediaKind
 * Alias für Rückwärtskompatibilität mit story-status.ts
 */
export type StoryMediaType = MediaKind

/**
 * @deprecated Verwende stattdessen getMediaKind
 * Alias für Rückwärtskompatibilität mit story-status.ts
 */
export const getStoryMediaType = getMediaKind
