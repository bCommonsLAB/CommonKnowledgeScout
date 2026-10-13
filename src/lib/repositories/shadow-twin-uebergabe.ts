/**
 * @fileoverview Twin-Dokument in der Ziel-Library anlegen (Wunschliste 8, W8-3).
 *
 * @description
 * `familie_uebergeben` gibt eine Quelle samt Familie von Library A nach B.
 * Hier entsteht das Twin-Dokument in `shadow_twins__<B>`:
 *
 * - **mit:** Transkript und Transformationen (`artifacts`) unveraendert, die
 *   Quellkennung (`sourceContentHash`, `sourceSize`, `sourceHashedAt`).
 * - **nicht mit:** `checkStand` (Plan-Cache von A, in B wertlos),
 *   `compositeSources` (Storage-Ids von A), `binaryFragments` (Blob-Adressen
 *   gehoeren der Library A; Seitenbilder entstehen in B neu, Owner-Entscheid 5
 *   des Plans), `filesystemSync` (der Export in B setzt ihn neu).
 *
 * `insertOne`, kein Upsert: Steht zu der neuen sourceId schon ein Dokument,
 * ist das ein Fehler (unique-Index), kein stilles Ueberschreiben.
 *
 * @module repositories
 */

import type { Quellkennung } from '@/lib/shadow-twin/quellkennung'
import { ensureShadowTwinIndexes, getShadowTwinCollection, type ShadowTwinDocument } from './shadow-twin-repo'

export async function legeTwinInZielAn(args: {
  quelle: ShadowTwinDocument
  nachLibraryId: string
  sourceId: string
  sourceName: string
  parentId: string
  userEmail: string
  quellkennung: Quellkennung
}): Promise<void> {
  const { quelle, nachLibraryId, sourceId, sourceName, parentId, userEmail, quellkennung } = args
  if (quelle.libraryId === nachLibraryId) throw new Error('legeTwinInZielAn: Ziel ist dieselbe Library — dafuer gibt es moveFamily')
  await ensureShadowTwinIndexes(nachLibraryId)
  const col = await getShadowTwinCollection(nachLibraryId)
  const jetzt = new Date().toISOString()
  const neu: ShadowTwinDocument = {
    libraryId: nachLibraryId,
    sourceId,
    sourceName,
    parentId,
    userEmail,
    artifacts: quelle.artifacts,
    filesystemSync: { enabled: false, shadowTwinFolderId: null, lastSyncedAt: null },
    createdAt: jetzt,
    updatedAt: jetzt,
    ...quellkennung,
  }
  await col.insertOne(neu)
}
