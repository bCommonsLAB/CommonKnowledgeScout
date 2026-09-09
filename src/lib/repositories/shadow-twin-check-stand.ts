/**
 * @fileoverview Schreibweg fuer den `checkStand` eines Twin-Dokuments.
 *
 * @description
 * Das Fingerabdruck-Tor des check-Modus legt hier ab, was es beim letzten Lauf
 * gesehen hat (Listing-Fingerabdruck, Mongo-Stand, Engine-Version, Report-Zeile).
 * Eigenes Modul statt Erweiterung von `shadow-twin-repo.ts` (Datei-Groessen-Limit),
 * genau wie `shadow-twin-location.ts`.
 *
 * Wichtig: `setCheckStand` bumpt `updatedAt` NICHT. Der Stand ist ein Merker
 * ueber den Zustand des Dokuments, kein Teil davon — wuerde er `updatedAt`
 * anfassen, machte er den gerade festgehaltenen Vergleichswert sofort ungueltig.
 *
 * @module repositories
 */

import { getCollection } from '@/lib/mongodb-service'
import {
  getShadowTwinCollectionName,
  type ShadowTwinCheckStand,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'

/** Legt den Check-Stand einer Quelle ab (eine `$set`-Operation). */
export async function setCheckStand(args: {
  libraryId: string
  sourceId: string
  checkStand: ShadowTwinCheckStand
}): Promise<void> {
  const { libraryId, sourceId, checkStand } = args
  const col = await getCollection<ShadowTwinDocument>(getShadowTwinCollectionName(libraryId))
  await col.updateOne({ libraryId, sourceId }, { $set: { checkStand } })
}

/**
 * Loescht den Check-Stand einer Quelle. Nach einer Reparatur ist er wertlos:
 * Storage und Mongo haben sich geaendert, der naechste Check rechnet frisch.
 */
export async function clearCheckStand(args: {
  libraryId: string
  sourceId: string
}): Promise<void> {
  const { libraryId, sourceId } = args
  const col = await getCollection<ShadowTwinDocument>(getShadowTwinCollectionName(libraryId))
  await col.updateOne({ libraryId, sourceId }, { $unset: { checkStand: '' } })
}
