/**
 * @fileoverview Archive-Item-Properties Repository (MongoDB).
 *
 * @description
 * Generischer Schluessel-Wert-Speicher fuer beliebige Eigenschaften eines
 * Archiv-Items. Erste Nutzung: Bildwahl `analysisSourceImage` der
 * DIVA-Texture-Welle; bewusst generisch gehalten fuer weitere Properties
 * (z.B. Favoriten o.ae.). Ein Dokument pro (libraryId, itemKey).
 *
 * Der `itemKey` ist eine STABILE, backend-unabhaengige ID (z.B. der
 * Liefersystem-VCodex), NICHT der filePath (Plan Edge-Case #18) — damit
 * Properties ein Umbenennen/Verschieben der Datei ueberleben.
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

export interface ArchiveItemPropertiesDocument {
  _id?: string
  libraryId: string
  itemKey: string
  properties: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const collectionCache = new Map<string, Collection<ArchiveItemPropertiesDocument>>()
const indexCache = new Set<string>()

export function getArchiveItemPropertiesCollectionName(libraryId: string): string {
  return `archive_item_properties__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<ArchiveItemPropertiesDocument>> {
  const name = getArchiveItemPropertiesCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<ArchiveItemPropertiesDocument>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(libraryId: string): Promise<void> {
  const name = getArchiveItemPropertiesCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await col.createIndex({ libraryId: 1, itemKey: 1 }, { unique: true })
  indexCache.add(name)
}

/** Liest die gespeicherten Properties eines Items (leeres Objekt, wenn keine). */
export async function getArchiveItemProperties(
  libraryId: string,
  itemKey: string,
): Promise<Record<string, unknown>> {
  const col = await getCol(libraryId)
  const doc = await col.findOne({ libraryId, itemKey })
  return doc?.properties ?? {}
}

/**
 * Merged die uebergebenen Properties in das bestehende Dokument (Upsert) und
 * gibt den vollstaendigen Property-Satz nach dem Merge zurueck.
 */
export async function mergeArchiveItemProperties(
  libraryId: string,
  itemKey: string,
  properties: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await ensureIndexes(libraryId)
  const col = await getCol(libraryId)
  const now = new Date().toISOString()
  const setFields: Record<string, unknown> = { libraryId, itemKey, updatedAt: now }
  for (const [k, v] of Object.entries(properties)) {
    setFields[`properties.${k}`] = v
  }
  await col.updateOne(
    { libraryId, itemKey },
    { $set: setFields, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )
  return getArchiveItemProperties(libraryId, itemKey)
}
