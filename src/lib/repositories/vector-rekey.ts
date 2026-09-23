/**
 * @fileoverview Schaufenster-Eintraege auf eine neue fileId umschreiben.
 *
 * @description
 * Die Vektor-Sammlung (Meta + Chunks, gelesen von `docs`/`doc-meta`) haengt an
 * der Storage-Id der Quelle. Auf Providern mit pfadbasierten Ids aendert ein
 * Umbenennen diese Id — der alte Eintrag blieb stehen, die naechste
 * Transformation legte einen zweiten daneben (Befund 23.09.2026: jede
 * umbenannte Datei doppelt in der oeffentlichen Liste).
 *
 * Umschreiben statt loeschen: Der Eintrag bleibt ohne Re-Ingest sichtbar, die
 * Zahl der Eintraege aendert sich nicht. `_id`s tragen die fileId als Praefix
 * (`<fileId>-meta`, Chunk-Ids), und `_id` ist nicht aenderbar — daher Kopie
 * unter neuer `_id`, dann Loeschen der alten. Eigene Datei: vector-repo.ts ist
 * weit ueber dem Groessen-Limit.
 *
 * @module repositories
 */

import type { Document } from 'mongodb'
import { getCollectionOnly } from '@/lib/repositories/vector-repo'
import { FileLogger } from '@/lib/debug/logger'

export interface RekeyResult {
  /** Anzahl umgeschriebener Dokumente (Meta + Chunks). 0 = es gab keinen Eintrag. */
  umgeschrieben: number
}

function neueId(alteId: unknown, alteFileId: string, neueFileId: string): unknown {
  if (typeof alteId !== 'string') return alteId
  return alteId.startsWith(alteFileId) ? neueFileId + alteId.slice(alteFileId.length) : alteId
}

/**
 * Schreibt alle Dokumente mit `fileId === alteFileId` auf `neueFileId` um.
 * Liegt unter der neuen fileId schon etwas, wird NICHT gemischt: Fehler, damit
 * der Aufrufer entscheidet (z. B. alten Eintrag bewusst loeschen).
 */
export async function rekeyVectorsFileId(
  libraryKey: string,
  alteFileId: string,
  neueFileId: string,
): Promise<RekeyResult> {
  if (alteFileId === neueFileId) return { umgeschrieben: 0 }
  const col = await getCollectionOnly(libraryKey)

  const alt = await col.find({ fileId: alteFileId }).toArray()
  if (alt.length === 0) return { umgeschrieben: 0 }

  const vorhanden = await col.countDocuments({ fileId: neueFileId }, { limit: 1 })
  if (vorhanden > 0) {
    throw new Error(
      `Schaufenster: unter der neuen fileId liegt schon ein Eintrag (${neueFileId}) — alter Eintrag ` +
        `(${alteFileId}, ${alt.length} Dokumente) nicht umgeschrieben; einen der beiden bewusst loeschen`,
    )
  }

  const kopien: Document[] = alt.map((doc) => ({
    ...doc,
    _id: neueId(doc._id, alteFileId, neueFileId),
    fileId: neueFileId,
  }))
  await col.insertMany(kopien)
  await col.deleteMany({ fileId: alteFileId })

  FileLogger.info('vector-rekey', 'Schaufenster-Eintrag auf neue fileId umgeschrieben', {
    libraryKey, alteFileId, neueFileId, anzahl: kopien.length,
  })
  return { umgeschrieben: kopien.length }
}
