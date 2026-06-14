/**
 * MongoDB-Adapter fuer den `LibraryDocumentSource`-Port (Welle A1).
 *
 * EINZIGE Stelle der A1-Engine, die das konkrete Backend kennt: die
 * Meta-Dokumente (`kind: 'meta'`) der Library-Collection tragen das flache
 * `docMetaJson`. Die Collection wird ueber den kanonischen Resolver
 * `getCollectionNameForLibrary` bestimmt (wirft bei fehlender Config — kein
 * stiller Fallback). Reparaturen schreiben gezielt `docMetaJson.<feld>` per
 * `$set` auf das jeweilige Meta-Dokument (`_id = "<fileId>-meta"`).
 */

import type { Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import type { Library } from '@/types/library'
import type { LibraryDocumentSource, VerifiableDocument } from './types'

interface MetaDocRow {
  fileId?: unknown
  fileName?: unknown
  docMetaJson?: unknown
}

/**
 * Erzeugt eine Dokumentquelle/Repair-Senke fuer eine Library.
 * Nur im Server-Kontext verwenden (API-Routen, Jobs).
 */
export function createMongoDocumentSource(library: Library): LibraryDocumentSource {
  const libraryKey = getCollectionNameForLibrary(library)
  const libraryId = library.id

  return {
    async listDocuments(): Promise<VerifiableDocument[]> {
      const col = await getCollection<Document>(libraryKey)
      const rows = await col
        .find(
          { kind: 'meta', libraryId },
          { projection: { _id: 0, fileId: 1, fileName: 1, docMetaJson: 1 } }
        )
        .toArray()

      const out: VerifiableDocument[] = []
      for (const raw of rows as MetaDocRow[]) {
        // Defensiver Typ-Guard auf die DB-Form: Meta-Dokumente tragen IMMER eine
        // fileId (_id = "<fileId>-meta"). Eine fehlende fileId ist eine Anomalie,
        // kein Normalfall — wir nehmen sie nicht in die Pruefung auf.
        if (typeof raw.fileId !== 'string' || raw.fileId.trim() === '') continue
        const docMetaJson =
          raw.docMetaJson && typeof raw.docMetaJson === 'object'
            ? (raw.docMetaJson as Record<string, unknown>)
            : {}
        out.push({
          fileId: raw.fileId,
          fileName: typeof raw.fileName === 'string' ? raw.fileName : undefined,
          docMetaJson,
        })
      }
      return out
    },

    async applyRepair(fileId: string, patch: Record<string, unknown>): Promise<void> {
      const entries = Object.entries(patch)
      if (entries.length === 0) return
      const set: Record<string, unknown> = {}
      for (const [field, value] of entries) {
        set[`docMetaJson.${field}`] = value
      }
      const col = await getCollection<Document>(libraryKey)
      // Meta-Dokumente nutzen eine string-_id ("<fileId>-meta"); Cast wie in
      // vector-repo.upsertVectorMeta noetig (Default-Typ erwartet ObjectId).
      await col.updateOne({ _id: `${fileId}-meta` } as Partial<Document>, { $set: set })
    },
  }
}
