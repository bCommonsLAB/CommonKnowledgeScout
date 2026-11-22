/**
 * @fileoverview Feste Plaetze des Teppichs berechnen und speichern (Plan
 * `teppich-der-dokumente`, T1).
 *
 * @description
 * DETERMINISTISCH (kein LLM, keine Vector-Suche): liest alle Meta-Dokumente der
 * Library, rechnet die Lage mit `berechneTeppichLagen` und schreibt sie flach nach
 * `docMetaJson.teppich_x`, `teppich_y`, `teppich_gewicht`, `teppich_stand`.
 * Grundlage der Aehnlichkeit sind die gespeicherten Nachbarn (`similarity_neighbors`,
 * Lauf `phase-doc-similarity`).
 *
 * no-silent-fallbacks: Seiten der Website werden bewusst ausgelassen und gezaehlt,
 * ebenso Zeilen ohne Kennung. Fehlen die Nachbarn bei ALLEN Dokumenten, wirft der
 * Lauf: Eine Lage ohne Aehnlichkeit waere Zufall.
 *
 * @usedIn src/lib/external-jobs/phase-doc-teppich.ts
 */

import type { AnyBulkWriteOperation, Document } from 'mongodb'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import type { Library } from '@/types/library'
import { berechneTeppichLagen, type TeppichEingabe } from './teppich-lage'
import { TEPPICH_PROJEKTION, istTeppichInhalt, leseTeppichEingabe, type TeppichMetaZeile } from './teppich-felder'

const SCHREIB_BATCH = 500

export interface TeppichPersistResult {
  dokumente: number
  geschrieben: number
  ausgelassenWebsite: number
  ohneKennung: number
  ohneDatum: number
  ohneNachbarn: number
  ohneUmfang: number
  schritte: number
  stand: string
}

export async function computeAndStoreTeppich(
  library: Library,
  libraryId: string,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<TeppichPersistResult> {
  const col = await getCollectionOnly(getCollectionNameForLibrary(library))
  const zeilen = await col
    .find({ kind: 'meta', libraryId } as unknown as Document, { projection: TEPPICH_PROJEKTION })
    .toArray() as unknown as TeppichMetaZeile[]

  let ausgelassenWebsite = 0
  let ohneKennung = 0
  const eingaben: TeppichEingabe[] = []
  for (const zeile of zeilen) {
    if (!istTeppichInhalt(zeile)) { ausgelassenWebsite++; continue }
    const e = leseTeppichEingabe(zeile)
    if (!e) { ohneKennung++; continue }
    eingaben.push(e)
  }
  if (eingaben.length === 0) {
    throw new Error('Keine Dokumente fuer den Teppich: Die Library hat keine indexierten Inhalte (Seiten der Website zaehlen nicht)')
  }

  const ergebnis = berechneTeppichLagen(eingaben)
  if (ergebnis.ohneNachbarn === eingaben.length) {
    throw new Error(
      'Kein Dokument hat Aehnlichkeits-Nachbarn. Zuerst die Nachbarn berechnen ' +
        '(Bruecke: nachbarn_berechnen; oder Galerie, Ansicht Graph, Quelle Aehnlichkeit: ' +
        '„Nachbarn neu berechnen"), dann den Teppich.',
    )
  }

  const stand = new Date().toISOString()
  let geschrieben = 0
  for (let start = 0; start < ergebnis.lagen.length; start += SCHREIB_BATCH) {
    const ops: AnyBulkWriteOperation<Document>[] = ergebnis.lagen.slice(start, start + SCHREIB_BATCH).map((l) => ({
      updateOne: {
        filter: { _id: `${l.fileId}-meta`, kind: 'meta' } as unknown as Document,
        update: {
          $set: {
            'docMetaJson.teppich_x': l.x,
            'docMetaJson.teppich_y': l.y,
            'docMetaJson.teppich_stand': stand,
            ...(l.gewicht !== null ? { 'docMetaJson.teppich_gewicht': l.gewicht } : {}),
          },
          // Ohne Umfang kein Gewicht — ein altes darf nicht stehen bleiben.
          ...(l.gewicht === null ? { $unset: { 'docMetaJson.teppich_gewicht': '' } } : {}),
        },
      },
    }))
    const res = await col.bulkWrite(ops, { ordered: false })
    geschrieben += res.matchedCount
    if (onProgress) await onProgress(Math.min(start + SCHREIB_BATCH, ergebnis.lagen.length), ergebnis.lagen.length)
  }

  return {
    dokumente: eingaben.length,
    geschrieben,
    ausgelassenWebsite,
    ohneKennung,
    ohneDatum: ergebnis.ohneDatum,
    ohneNachbarn: ergebnis.ohneNachbarn,
    ohneUmfang: ergebnis.ohneUmfang,
    schritte: ergebnis.schritte,
    stand,
  }
}
