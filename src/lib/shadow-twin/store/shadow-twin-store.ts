/**
 * @fileoverview Shadow-Twin Store Interface - Abstraktion für Shadow-Twin Storage
 *
 * @description
 * Definiert das Interface für Shadow-Twin Stores, die Artefakte lesen und schreiben können.
 * Ermöglicht verschiedene Implementierungen (MongoDB, Filesystem/Provider) mit einheitlicher API.
 *
 * @module shadow-twin/store
 *
 * @exports
 * - ShadowTwinStore: Interface für Shadow-Twin Storage-Implementierungen
 * - ArtifactMarkdownResult: Ergebnis beim Laden von Markdown-Artefakten
 * - UpsertArtifactResult: Ergebnis beim Speichern von Artefakten
 * - BinaryFragment: Typ für Binary-Fragmente
 */

import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

/**
 * Ergebnis beim Laden eines Markdown-Artefakts.
 */
export interface ArtifactMarkdownResult {
  /** Eindeutige ID des Artefakts (z.B. MongoDB-ID oder Storage-Item-ID) */
  id: string
  /** Dateiname des Artefakts */
  name: string
  /** Markdown-Inhalt */
  markdown: string
  /** Optional: Frontmatter-Metadaten */
  frontmatter?: Record<string, unknown>
}

/**
 * Ergebnis beim Speichern eines Artefakts.
 */
export interface UpsertArtifactResult {
  /** Eindeutige ID des gespeicherten Artefakts */
  id: string
  /** Dateiname des Artefakts */
  name: string
}

/**
 * Binary-Fragment (z.B. Bild, Audio).
 */
export interface BinaryFragment {
  /** Dateiname des Fragments */
  name: string
  /** Optional: URL (z.B. Azure Blob Storage URL) */
  url?: string
  /** Optional: Hash des Inhalts */
  hash?: string
  /** Optional: MIME-Typ */
  mimeType?: string
  /** Optional: Größe in Bytes */
  size?: number
}

/**
 * Interface für Shadow-Twin Storage-Implementierungen.
 *
 * Jede Implementierung (MongoDB, Filesystem/Provider) muss diese Methoden bereitstellen.
 */
export interface ShadowTwinStore {
  /**
   * Prüft, ob ein Artefakt existiert.
   *
   * @param key Artefakt-Schlüssel
   * @returns true wenn das Artefakt existiert, sonst false
   */
  existsArtifact(key: ArtifactKey): Promise<boolean>

  /**
   * Lädt ein Markdown-Artefakt.
   *
   * @param key Artefakt-Schlüssel
   * @returns Artefakt-Daten oder null wenn nicht gefunden
   */
  getArtifactMarkdown(key: ArtifactKey): Promise<ArtifactMarkdownResult | null>

  /**
   * Speichert oder aktualisiert ein Markdown-Artefakt.
   *
   * @param key Artefakt-Schlüssel
   * @param markdown Markdown-Inhalt
   * @param binaryFragments Optional: Binary-Fragmente (z.B. Bilder)
   * @param context Zusätzlicher Kontext (libraryId, userEmail, sourceName, parentId)
   * @returns Ergebnis mit ID und Name des gespeicherten Artefakts
   */
  upsertArtifact(
    key: ArtifactKey,
    markdown: string,
    binaryFragments?: BinaryFragment[],
    context?: {
      libraryId: string
      userEmail: string
      sourceName: string
      parentId: string
    }
  ): Promise<UpsertArtifactResult>

  /**
   * Lädt alle Binary-Fragmente für eine Quelle.
   *
   * @param sourceId ID der Quelle
   * @returns Array von Binary-Fragmenten oder null wenn nicht gefunden
   */
  getBinaryFragments(sourceId: string): Promise<BinaryFragment[] | null>
}
