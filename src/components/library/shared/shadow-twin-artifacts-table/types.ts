/**
 * shared/shadow-twin-artifacts-table/types.ts
 *
 * Type-Definitionen fuer ShadowTwinArtifactsTable.
 *
 * Aus `shared/shadow-twin-artifacts-table.tsx` ausgegliedert
 * (Welle 3-II-d, Schritt 4/7).
 *
 * 3 Interfaces beschreiben die Daten-Struktur, die die Komponente
 * von der Migrations-API + Mongo-API erhaelt.
 */

/**
 * Binary-Fragment aus dem Shadow-Twin (z.B. PDF-Bild oder Cover-Image,
 * wird in Azure oder Filesystem gespeichert).
 */
export interface BinaryFragment {
  sourceId: string
  sourceName: string
  name: string
  kind: string
  url?: string
  hash?: string
  mimeType?: string
  size?: number
  createdAt: string
}

/**
 * Markdown-Artefakt im Shadow-Twin (Transcript oder Transformation).
 */
export interface Artifact {
  sourceId: string
  sourceName: string
  artifactFileName: string
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  mongoUpserted: boolean
  filesystemDeleted?: boolean
}

/**
 * Vereinheitlichter Tabellen-Eintrag — repraesentiert sowohl
 * BinaryFragment als auch Artifact in einer Liste.
 */
export interface FileEntry {
  sourceId: string
  sourceName: string
  fileName: string
  kind: string
  mimeType?: string
  size?: number
  url?: string
  hash?: string
  mongoUpserted: boolean
  filesystemDeleted: boolean
  artifactKind?: 'transcript' | 'transformation'
  targetLanguage?: string
  templateName?: string
}
