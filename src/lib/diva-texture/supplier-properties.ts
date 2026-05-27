/**
 * @fileoverview DIVA-Textur-Properties in MongoDB (Performance-/Persistenz-Welle).
 *
 * @description
 * Speichert/liest den deterministischen Liefersystem-Snapshot je Textur im
 * generischen Archiv-Property-Store (`archive_item_properties__<libraryId>`).
 * itemKey = VCodex (stabil, ueberlebt Umbenennen — Plan Edge-Case #18,
 * konsistent mit der Bildwahl `analysisSourceImage`).
 *
 * Diese persistierten Records sind die LAUFZEIT-QUELLE dafuer, welche Dateien
 * DIVA-Texturen sind (Filter „mit/ohne DIVA-Info") und liefern die Instant-Info
 * ohne erneutes Parsen der grossen Sidecar-JSON.
 *
 * Reiner Daten-Layer: der pure Builder ist I/O-frei + testbar; Read/Write
 * gehen ueber das generische Repo (kein direkter Storage-/DB-Zugriff hier).
 */

import {
  mergeArchiveItemProperties,
  findArchiveItemsByProperties,
  type ArchiveItemPropertiesDocument,
} from '@/lib/repositories/archive-item-properties-repo'
import type { OptionvalueEntry } from './types'

/** Property-Schluessel (flach im generischen Property-Store). */
export const DIVA_PROPERTY_KEYS = {
  isTexture: 'divaTexture',
  fileName: 'divaTextureFileName',
  fileId: 'divaTextureFileId',
  parentId: 'divaTextureParentId',
  strategy: 'divaMatchStrategy',
  preprocessedAt: 'divaPreprocessedAt',
  snapshot: 'divaSupplierSnapshot',
} as const

/** 1:1-Snapshot des Sidecar-Eintrags (fuer Instant-Info + Re-Analyse). */
export interface DivaSupplierSnapshot {
  sourceFile: string
  sourceFileHash?: string
  fetchedAt: string
  entry: OptionvalueEntry
}

/** Laufzeit-Sicht eines DIVA-Textur-Records. */
export interface DivaTextureRecord {
  vcodex: string
  fileName: string
  fileId: string
  parentId: string
  strategy: string
  snapshot: DivaSupplierSnapshot | null
}

export interface BuildDivaPropsArgs {
  entry: OptionvalueEntry
  file: { id: string; name: string }
  parentId: string
  /** Dateiname der Sidecar (z.B. api2_GetJsonOptionValues.json). */
  sourceFile: string
  sourceFileHash?: string
  strategy: string
  /** ISO-Zeitstempel; Default jetzt (fuer deterministische Tests setzbar). */
  now?: string
}

/**
 * Baut das flache Property-Objekt fuer einen DIVA-Textur-Treffer.
 * Pure + idempotent (gleiche Eingaben → gleiches Objekt, sofern `now` gesetzt).
 */
export function buildDivaTextureProperties(args: BuildDivaPropsArgs): Record<string, unknown> {
  const timestamp = args.now ?? new Date().toISOString()
  const snapshot: DivaSupplierSnapshot = {
    sourceFile: args.sourceFile,
    fetchedAt: timestamp,
    entry: args.entry,
    ...(args.sourceFileHash ? { sourceFileHash: args.sourceFileHash } : {}),
  }
  return {
    [DIVA_PROPERTY_KEYS.isTexture]: true,
    [DIVA_PROPERTY_KEYS.fileName]: args.file.name,
    [DIVA_PROPERTY_KEYS.fileId]: args.file.id,
    [DIVA_PROPERTY_KEYS.parentId]: args.parentId,
    [DIVA_PROPERTY_KEYS.strategy]: args.strategy,
    [DIVA_PROPERTY_KEYS.preprocessedAt]: timestamp,
    [DIVA_PROPERTY_KEYS.snapshot]: snapshot,
  }
}

/** Schreibt/merged den DIVA-Snapshot (itemKey = VCodex) in MongoDB. */
export async function writeDivaTextureSnapshot(
  libraryId: string,
  args: BuildDivaPropsArgs,
): Promise<void> {
  await mergeArchiveItemProperties(libraryId, args.entry.VCodex, buildDivaTextureProperties(args))
}

function isOptionvalueEntry(value: unknown): value is OptionvalueEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.VCodex === 'string'
}

/** Wandelt ein Repo-Dokument in einen Laufzeit-Record (null, wenn kein DIVA). */
export function toDivaTextureRecord(doc: ArchiveItemPropertiesDocument): DivaTextureRecord | null {
  const p = doc.properties ?? {}
  if (p[DIVA_PROPERTY_KEYS.isTexture] !== true) return null

  const rawSnapshot = p[DIVA_PROPERTY_KEYS.snapshot]
  let snapshot: DivaSupplierSnapshot | null = null
  if (rawSnapshot && typeof rawSnapshot === 'object') {
    const s = rawSnapshot as Record<string, unknown>
    if (isOptionvalueEntry(s.entry) && typeof s.sourceFile === 'string' && typeof s.fetchedAt === 'string') {
      snapshot = {
        sourceFile: s.sourceFile,
        fetchedAt: s.fetchedAt,
        entry: s.entry,
        ...(typeof s.sourceFileHash === 'string' ? { sourceFileHash: s.sourceFileHash } : {}),
      }
    }
  }

  return {
    vcodex: doc.itemKey,
    fileName: typeof p[DIVA_PROPERTY_KEYS.fileName] === 'string' ? (p[DIVA_PROPERTY_KEYS.fileName] as string) : '',
    fileId: typeof p[DIVA_PROPERTY_KEYS.fileId] === 'string' ? (p[DIVA_PROPERTY_KEYS.fileId] as string) : '',
    parentId: typeof p[DIVA_PROPERTY_KEYS.parentId] === 'string' ? (p[DIVA_PROPERTY_KEYS.parentId] as string) : '',
    strategy: typeof p[DIVA_PROPERTY_KEYS.strategy] === 'string' ? (p[DIVA_PROPERTY_KEYS.strategy] as string) : '',
    snapshot,
  }
}

/** Alle DIVA-Texturen eines Ordners (fuer den Dateilisten-Filter). */
export async function getDivaTexturesByParent(
  libraryId: string,
  parentId: string,
): Promise<DivaTextureRecord[]> {
  const docs = await findArchiveItemsByProperties(libraryId, {
    [DIVA_PROPERTY_KEYS.isTexture]: true,
    [DIVA_PROPERTY_KEYS.parentId]: parentId,
  })
  return docs.map(toDivaTextureRecord).filter((r): r is DivaTextureRecord => r !== null)
}

/** DIVA-Record zu einer konkreten Datei-ID (fuer Instant-Info), oder null. */
export async function getDivaTextureByFileId(
  libraryId: string,
  fileId: string,
): Promise<DivaTextureRecord | null> {
  const docs = await findArchiveItemsByProperties(libraryId, {
    [DIVA_PROPERTY_KEYS.fileId]: fileId,
  })
  for (const doc of docs) {
    const record = toDivaTextureRecord(doc)
    if (record) return record
  }
  return null
}
