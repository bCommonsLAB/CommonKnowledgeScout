/**
 * @fileoverview Source Adapter Types - Canonical Markdown Pipeline
 *
 * @description
 * Definiert die Interfaces für Source-Adapter, die verschiedene Quellen (PDF, Audio, Markdown, TXT, Website, CSV)
 * in ein einheitliches "Canonical Markdown" Format normalisieren.
 *
 * @module external-jobs/sources
 *
 * @exports
 * - SourceAdapter: Interface für Format-spezifische Normalisierung
 * - CanonicalMarkdownResult: Ergebnis der Normalisierung
 * - SourceInput: Eingabe für Normalisierung (StorageItem oder URL)
 */

import type { StorageItem } from '@/lib/storage/types'

/**
 * Eingabe für Normalisierung.
 * Kann entweder ein StorageItem (Datei) oder eine URL (Website) sein.
 */
export type SourceInput = StorageItem | { url: string; type: 'url' }

/**
 * Ergebnis der Normalisierung zu Canonical Markdown.
 */
export interface CanonicalMarkdownResult {
  /**
   * Normalisiertes Markdown mit Frontmatter.
   * Muss mindestens enthalten:
   * - source: Quelle (Dateiname, URL, etc.)
   * - title: Titel (aus Quelle extrahiert oder generiert)
   * - date: Datum/Crawl-Zeit
   * - type: Format-Typ (pdf, audio, markdown, txt, website, csv, etc.)
   * - originRef: Referenz auf Original-Rohdaten-Artefakt (lossless)
   */
  canonicalMarkdown: string

  /**
   * Frontmatter-Metadaten (extrahierte oder generierte).
   * Wird in das Frontmatter des canonicalMarkdown eingebaut.
   */
  canonicalMeta: Record<string, unknown>

  /**
   * Referenz auf gespeichertes Raw-Origin-Artefakt (optional).
   * Wenn gesetzt, muss das Artefakt existieren (lossless backup).
   */
  rawOriginRef?: {
    /** Storage-Item-ID des Raw-Origin-Artefakts */
    fileId: string
    /** Dateiname des Raw-Origin-Artefakts */
    fileName: string
  }
}

/**
 * Source Adapter Interface.
 *
 * Jede Quelle (PDF, Audio, Markdown, TXT, Website, CSV, ...) implementiert diesen Adapter,
 * um die Quelle in Canonical Markdown zu normalisieren.
 */
export interface SourceAdapter {
  /**
   * Normalisiert die Quelle zu Canonical Markdown.
   *
   * @param source Source-Daten (StorageItem oder URL)
   * @param options Optionale Parameter (z.B. targetLanguage, userEmail, libraryId)
   * @returns Canonical Markdown + Meta + Raw Origin Referenz
   */
  normalize(
    source: SourceInput,
    options?: SourceAdapterOptions
  ): Promise<CanonicalMarkdownResult>
}

/**
 * Optionale Parameter für Source-Adapter.
 */
export interface SourceAdapterOptions {
  /** Zielsprache für Normalisierung (z.B. 'de', 'en') */
  targetLanguage?: string
  /** User-Email für Berechtigungsprüfung */
  userEmail?: string
  /** Library-ID für Kontext */
  libraryId?: string
  /** Storage-Provider für Artefakt-Speicherung */
  provider?: import('@/lib/storage/types').StorageProvider
}

/**
 * Format-Typ für Canonical Markdown.
 * Wird im Frontmatter als `type` gespeichert.
 */
export type SourceFormatType =
  | 'pdf'
  | 'audio'
  | 'video'
  | 'markdown'
  | 'txt'
  | 'website'
  | 'csv'
  | 'html'
  | 'docx'
  | 'pptx'
  | 'xlsx'
