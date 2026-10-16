/**
 * @fileoverview Sicherung aller Dokumente, die das Umschreiben anfasst.
 *
 * @description
 * Vor `--apply`: Twins, Transkript-Segmente, Beziehungen, Suchindex sowie
 * Sterne und Kommentare der Library als JSON (MongoDB Extended JSON, damit
 * Datumswerte und ObjectIds beim Zurueckspielen erhalten bleiben) und die
 * Library selbst (wegen der Favoriten). Enthaelt keine Zugangsdaten — die
 * liegen an der Speicher-Verbindung, nicht an der Library.
 *
 * @module storage-remap
 */

import * as fs from 'fs'
import * as path from 'path'
import { BSON, type Document } from 'mongodb'
import type { Library } from '@/types/library'
import { getCollection } from '@/lib/mongodb-service'
import { getShadowTwinCollectionName } from '@/lib/repositories/shadow-twin-repo'
import { getDocRelationsCollectionName } from '@/lib/repositories/doc-relations-repo'
import { getTranscriptSegmentsCollectionName } from '@/lib/repositories/transcript-segments-repo'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { SOURCE_USER_STATES_COLLECTION } from '@/lib/repositories/source-user-states-repo'
import { SOURCE_COMMENTS_COLLECTION } from '@/lib/repositories/source-comments-repo'

async function alle(name: string, filter: Document): Promise<Document[]> {
  const col = await getCollection<Document>(name)
  return col.find(filter).toArray()
}

/** Schreibt die Sicherung nach backups/ und gibt den Dateipfad zurueck. */
export async function schreibeSicherung(library: Library): Promise<string> {
  const lib = library.id
  const daten: Record<string, Document[] | Library> = {
    library,
    [getShadowTwinCollectionName(lib)]: await alle(getShadowTwinCollectionName(lib), { libraryId: lib }),
    [getTranscriptSegmentsCollectionName(lib)]: await alle(getTranscriptSegmentsCollectionName(lib), { libraryId: lib }),
    [getDocRelationsCollectionName(lib)]: await alle(getDocRelationsCollectionName(lib), {}),
    [SOURCE_USER_STATES_COLLECTION]: await alle(SOURCE_USER_STATES_COLLECTION, { libraryId: lib }),
    [SOURCE_COMMENTS_COLLECTION]: await alle(SOURCE_COMMENTS_COLLECTION, { libraryId: lib }),
  }
  if (library.config?.chat?.vectorStore?.collectionName?.trim()) {
    const name = getCollectionNameForLibrary(library)
    daten[name] = await alle(name, {})
  }

  const dir = path.join(process.cwd(), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const datei = path.join(dir, `storage-remap-${lib}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(datei, BSON.EJSON.stringify(daten, undefined, 0, { relaxed: false }), 'utf8')
  return datei
}
