/**
 * file-list/list-utils.ts
 *
 * Reine Hilfsfunktionen und Typen, die aus `file-list.tsx`
 * (Welle 3-I, Schritt 4b) extrahiert wurden. Ziel: Logik testbar
 * und wiederverwendbar machen, ohne den Import-Pfad fuer Konsumenten
 * (`@/components/library/file-list`) zu aendern.
 *
 * Diese Datei ist storage-agnostisch und enthaelt keine Hooks
 * (siehe `.cursor/rules/welle-3-schale-loader-contracts.mdc` §1).
 */

import type { StorageItem } from '@/lib/storage/types';

/** Sortier-Felder der Datei-Liste */
export type SortField = 'type' | 'name' | 'size' | 'date';

/** Sortier-Reihenfolge der Datei-Liste */
export type SortOrder = 'asc' | 'desc';

/**
 * Metadaten fuer die Listen-Anzeige (Titel, Nummer, Cover) — abgeleitet
 * aus dem Frontmatter der Transformations-Datei (Mongo-Pfad ueber
 * `batch-resolve`-Route).
 */
export interface ListMeta {
  title?: string;
  number?: string;
  coverImageUrl?: string;
  /** Fragment-Name des Thumbnails (z.B. WebP); wenn vorhanden, in der Liste bevorzugt nutzen */
  coverThumbnailUrl?: string;
}

/**
 * Gruppierung einer Quelldatei mit ihren Shadow-Twin-Artefakten
 * (Transkripte und Transformation), wie sie in der Liste pro Zeile
 * angezeigt wird.
 */
export interface FileGroup {
  baseItem?: StorageItem;
  /** Alle Transkripte (eine Datei kann mehrere Sprachen haben) */
  transcriptFiles?: StorageItem[];
  transformed?: StorageItem;
  /** ID des Shadow-Twin-Verzeichnisses (nur Filesystem-Modus) */
  shadowTwinFolderId?: string;
  /** Ingestion-Status (Story publiziert) — aus Shadow-Twin-Analyse */
  ingestionStatus?: { exists: boolean; chunkCount?: number; chaptersCount?: number };
  /** Titel/Nummer/Cover fuer Listen-Anzeige (Mongo-Pfad) */
  listMeta?: ListMeta;
}

/**
 * Ermittelt den Dateityp basierend auf der Dateiendung.
 *
 * Rueckgabe ist eine kanonische Kategorie wie `pdf`, `audio`, `image`,
 * die das Icon-Mapping in `file-icon.tsx` verwendet.
 *
 * Bewusst keine Endung → `unknown` (Default-File-Icon im Aufrufer).
 */
export function getFileTypeFromName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    // Textdateien & Markdown
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    // Video
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
    case 'wmv':
    case 'flv':
      return 'video';
    // Audio
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
    case 'aac':
      return 'audio';
    // Bilder
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
    case 'tiff':
    case 'tif':
      return 'image';
    // PDF
    case 'pdf':
      return 'pdf';
    // Word-Dokumente
    case 'doc':
    case 'docx':
    case 'odt':
    case 'rtf':
      return 'docx';
    // PowerPoint-Praesentationen
    case 'ppt':
    case 'pptx':
    case 'odp':
      return 'pptx';
    // Excel-Tabellen
    case 'xls':
    case 'xlsx':
    case 'ods':
    case 'csv':
      return 'xlsx';
    // URL/Website-Verknuepfungen
    case 'url':
    case 'webloc':
      return 'website';
    // Code & Config-Dateien als Text behandeln
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'ini':
    case 'cfg':
    case 'conf':
    case 'log':
    case 'html':
    case 'htm':
    case 'css':
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'cs':
    case 'php':
    case 'rb':
    case 'go':
    case 'rs':
    case 'swift':
    case 'kt':
    case 'scala':
    case 'r':
    case 'sh':
    case 'bash':
    case 'ps1':
    case 'bat':
    case 'cmd':
      return 'code';
    default:
      return 'unknown';
  }
}

/**
 * Formatiert eine Dateigroesse mit der naechsthoeheren Einheit (B, KB, MB, GB).
 * `undefined`/`0` → `'-'`.
 */
export function formatFileSize(size?: number): string {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Formatiert ein Datum im deutschen Listen-Stil (`tt.mm.jj, hh:mm`).
 * `undefined` → `'-'`.
 */
export function formatDate(date?: Date): string {
  if (!date) return '-';

  const options: Intl.DateTimeFormatOptions = {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Date(date).toLocaleDateString('de-DE', options);
}
