/**
 * @fileoverview Suchindex (Schaufenster) und Dokument-Beziehungen auf neue Storage-Ids.
 *
 * @description
 * Schaufenster: `fileId` und `_id`-Praefix ueber `rekeyVectorsFileId`
 * (Kopie unter neuer `_id`, dann Loeschen — `_id` ist unveraenderlich).
 * Danach die verschachtelten Verweise: `parentId`, `docMetaJson.sourceFileId`,
 * `docMetaJson.similarity_neighbors[].fileId`. Beziehungen:
 * `sourceFileId`/`targetFileId` in `doc_relations__<libraryId>`.
 *
 * @module storage-remap
 */

import type { Document } from 'mongodb'
import type { Library } from '@/types/library'
import { getCollection } from '@/lib/mongodb-service'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { rekeyVectorsFileId } from '@/lib/repositories/vector-rekey'
import { getDocRelationsCollectionName } from '@/lib/repositories/doc-relations-repo'

export interface IndexErgebnis {
  /** null = Library hat keinen Suchindex konfiguriert. */
  quellenImIndex: number | null
  quellenUmgeschrieben: number
  dokumenteUmgeschrieben: number
  verweiseNachgezogen: number
  beziehungen: number
}

interface VerweisDoc {
  _id: unknown
  parentId?: string
  docMetaJson?: { sourceFileId?: unknown; similarity_neighbors?: unknown }
}

/** Rein: $set fuer die verschachtelten Verweise eines Index-Dokuments, oder null. */
export function verweisUpdate(doc: VerweisDoc, idMap: Map<string, string>): Record<string, unknown> | null {
  const set: Record<string, unknown> = {}
  if (typeof doc.parentId === 'string' && idMap.has(doc.parentId)) set.parentId = idMap.get(doc.parentId)
  const meta = doc.docMetaJson
  if (meta && typeof meta.sourceFileId === 'string' && idMap.has(meta.sourceFileId)) {
    set['docMetaJson.sourceFileId'] = idMap.get(meta.sourceFileId)
  }
  if (meta && Array.isArray(meta.similarity_neighbors)) {
    let geaendert = false
    const nachbarn = meta.similarity_neighbors.map((n: unknown) => {
      const eintrag = n as { fileId?: unknown }
      if (typeof eintrag?.fileId === 'string' && idMap.has(eintrag.fileId)) {
        geaendert = true
        return { ...eintrag, fileId: idMap.get(eintrag.fileId) }
      }
      return n
    })
    if (geaendert) set['docMetaJson.similarity_neighbors'] = nachbarn
  }
  return Object.keys(set).length > 0 ? set : null
}

export async function remapIndex(library: Library, idMap: Map<string, string>, probelauf: boolean): Promise<IndexErgebnis> {
  const ergebnis: IndexErgebnis = {
    quellenImIndex: null, quellenUmgeschrieben: 0, dokumenteUmgeschrieben: 0, verweiseNachgezogen: 0, beziehungen: 0,
  }

  if (library.config?.chat?.vectorStore?.collectionName?.trim()) {
    const name = getCollectionNameForLibrary(library)
    const col = await getCollectionOnly(name)
    const fileIds = (await col.distinct('fileId')) as unknown[]
    ergebnis.quellenImIndex = fileIds.length
    for (const alt of fileIds) {
      if (typeof alt !== 'string' || !idMap.has(alt)) continue
      ergebnis.quellenUmgeschrieben++
      if (!probelauf) {
        const { umgeschrieben } = await rekeyVectorsFileId(name, alt, idMap.get(alt) as string)
        ergebnis.dokumenteUmgeschrieben += umgeschrieben
      }
    }
    const kandidaten = (await col
      .find({}, { projection: { parentId: 1, 'docMetaJson.sourceFileId': 1, 'docMetaJson.similarity_neighbors': 1 } })
      .toArray()) as unknown as VerweisDoc[]
    for (const doc of kandidaten) {
      const set = verweisUpdate(doc, idMap)
      if (!set) continue
      ergebnis.verweiseNachgezogen++
      if (!probelauf) await col.updateOne({ _id: doc._id } as Document, { $set: set })
    }
  }

  const rel = await getCollection<Document>(getDocRelationsCollectionName(library.id))
  const kanten = await rel.find({}, { projection: { sourceFileId: 1, targetFileId: 1 } }).toArray()
  for (const k of kanten) {
    const set: Record<string, string> = {}
    if (typeof k.sourceFileId === 'string' && idMap.has(k.sourceFileId)) set.sourceFileId = idMap.get(k.sourceFileId) as string
    if (typeof k.targetFileId === 'string' && idMap.has(k.targetFileId)) set.targetFileId = idMap.get(k.targetFileId) as string
    if (Object.keys(set).length === 0) continue
    ergebnis.beziehungen++
    if (!probelauf) await rel.updateOne({ _id: k._id }, { $set: set })
  }
  return ergebnis
}
