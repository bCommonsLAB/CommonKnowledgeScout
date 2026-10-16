/**
 * @fileoverview Sterne, Kommentare und Ordner-Favoriten auf neue Storage-Ids.
 *
 * @description
 * `source_user_states.fileId` und `source_comments.fileId` (je `libraryId`)
 * sowie `favorites[].id` an der Library. Historie (external_jobs,
 * wizard_*, aktions_protokoll, queries) bleibt bewusst unveraendert: sie
 * beschreibt, was damals war.
 *
 * @module storage-remap
 */

import type { Document } from 'mongodb'
import type { Library } from '@/types/library'
import { getCollection } from '@/lib/mongodb-service'
import { LibraryService } from '@/lib/services/library-service'
import { SOURCE_USER_STATES_COLLECTION } from '@/lib/repositories/source-user-states-repo'
import { SOURCE_COMMENTS_COLLECTION } from '@/lib/repositories/source-comments-repo'

export interface UserErgebnis {
  sterne: number
  kommentare: number
  favoriten: number
}

async function remapFileIdFeld(
  collectionName: string,
  libraryId: string,
  idMap: Map<string, string>,
  probelauf: boolean,
): Promise<number> {
  const col = await getCollection<Document>(collectionName)
  const docs = await col.find({ libraryId, fileId: { $in: [...idMap.keys()] } }, { projection: { fileId: 1 } }).toArray()
  if (!probelauf) {
    for (const d of docs) await col.updateOne({ _id: d._id }, { $set: { fileId: idMap.get(d.fileId as string) } })
  }
  return docs.length
}

export async function remapUserDaten(
  ownerEmail: string,
  library: Library,
  idMap: Map<string, string>,
  probelauf: boolean,
): Promise<UserErgebnis> {
  const sterne = await remapFileIdFeld(SOURCE_USER_STATES_COLLECTION, library.id, idMap, probelauf)
  const kommentare = await remapFileIdFeld(SOURCE_COMMENTS_COLLECTION, library.id, idMap, probelauf)

  const favoriten = (library.favorites ?? []).filter((f) => idMap.has(f.id)).length
  if (!probelauf && favoriten > 0) {
    const neu = (library.favorites ?? []).map((f) => (idMap.has(f.id) ? { ...f, id: idMap.get(f.id) as string } : f))
    const ok = await LibraryService.getInstance().updateLibrary(ownerEmail, { ...library, favorites: neu })
    if (!ok) throw new Error('Favoriten: Library konnte nicht aktualisiert werden')
  }
  return { sterne, kommentare, favoriten }
}
