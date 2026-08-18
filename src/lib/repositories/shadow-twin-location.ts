/**
 * @fileoverview Ort/Name eines Twin-Dokuments nachziehen (Welle 0e).
 *
 * @description
 * Nach einem Familien-Umzug (move-family.ts) muessen `sourceName` und
 * `parentId` im Twin-Dokument dem neuen Storage-Zustand folgen — die Identitaet
 * (`sourceId`) bleibt unveraendert. Eigenes Modul statt Erweiterung von
 * shadow-twin-repo.ts (Datei-Groessen-Limit).
 *
 * @module repositories
 */

import { getCollection } from '@/lib/mongodb-service'
import {
  getShadowTwinCollectionName,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'

/**
 * Setzt `sourceName`/`parentId` des Twin-Dokuments. Wirft, wenn kein Dokument
 * existiert — der Aufrufer hat die Existenz geprueft; still nichts zu tun
 * waere ein verschleierter Zustandsfehler (`no-silent-fallbacks`).
 */
export async function updateShadowTwinSourceLocation(args: {
  libraryId: string
  sourceId: string
  sourceName: string
  parentId: string
}): Promise<void> {
  const { libraryId, sourceId, sourceName, parentId } = args
  const col = await getCollection<ShadowTwinDocument>(getShadowTwinCollectionName(libraryId))
  const res = await col.updateOne(
    { libraryId, sourceId },
    { $set: { sourceName, parentId, updatedAt: new Date().toISOString() } },
  )
  if (res.matchedCount === 0) {
    throw new Error(`updateShadowTwinSourceLocation: kein Twin-Dokument fuer sourceId=${sourceId}`)
  }
}
