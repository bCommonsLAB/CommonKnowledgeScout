/**
 * @fileoverview Quelle samt Familie nach „zu klären" verschieben (C4) — EIN Weg fuer zwei Werkzeuge.
 *
 * @description
 * Bisher steckte der Ablauf direkt im Werkzeug `quelle_verwerfen`. Seit
 * Wunschliste 8, W8-3 nutzt ihn auch `familie_uebergeben` (`herkunft:
 * verwerfen`) — deshalb hier, statt ein zweites Mal geschrieben.
 *
 * Nichts wird geloescht: Die Quelle zieht mit ihrer Twin-Familie in den
 * Unterordner „zu klären" ihres Elternordners (bei Bedarf angelegt), MongoDB
 * zieht ueber `moveFamily` mit. Rueckgaengig = `familie_umziehen` zurueck.
 *
 * @module shadow-twin
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { KLAER_ORDNER } from './klaer-ordner'
import { moveFamily, type MoveFamilyResult } from './move-family'

export { KLAER_ORDNER }

/** Liegt die Quelle schon im Klaer-Ordner? (Elternordner heisst so.) */
export async function liegtImKlaerOrdner(provider: StorageProvider, source: StorageItem): Promise<boolean> {
  const parent = await provider.getItemById(source.parentId).catch(() => null)
  return parent !== null && parent.metadata.name.toLowerCase() === KLAER_ORDNER.toLowerCase()
}

export async function verwirfQuelle(args: {
  library: Library
  libraryId: string
  userEmail: string
  provider: StorageProvider
  sourceId: string
}): Promise<{ klaerOrdner: { folderId: string; name: string }; result: MoveFamilyResult }> {
  const { library, libraryId, userEmail, provider, sourceId } = args
  const source = await provider.getItemById(sourceId)
  if (!source || source.type !== 'file') throw new Error(`${sourceId} ist keine Datei`)
  if (await liegtImKlaerOrdner(provider, source)) {
    throw new Error(`"${source.metadata.name}" liegt bereits in „${KLAER_ORDNER}“ — nichts zu tun`)
  }
  // „zu klaeren“ im Elternordner finden oder anlegen (Entscheid Peter 2026-08-21).
  const siblings = await provider.listItemsById(source.parentId)
  const vorhanden = siblings.find(
    (item) => item.type === 'folder' && item.metadata.name.toLowerCase() === KLAER_ORDNER.toLowerCase(),
  )
  const klaer = vorhanden ?? (await provider.createFolder(source.parentId, KLAER_ORDNER))
  const result = await moveFamily({ library, libraryId, userEmail, provider, sourceId, newParentId: klaer.id })
  return { klaerOrdner: { folderId: klaer.id, name: klaer.metadata.name }, result }
}
