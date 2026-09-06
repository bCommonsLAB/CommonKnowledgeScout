/**
 * @fileoverview Uebersetzung der Library-Verifikation A1 in Coverage-Befunde.
 *
 * @description
 * Die Feld-Pruefung selbst bleibt vollstaendig bei A1 (`library-verification/`)
 * — hier wird ihr Ergebnis nur in das Lueckenmodell uebersetzt (Leitprinzip 1,
 * wie `engine-gaps.ts` fuer die Sync-Engine). Uebernommen werden ZWEI Codes:
 * `missing-base-field` (F2: „A0-Pflichtfelder fehlen") und `implausible-date`
 * (W5: ein gefuelltes, aber falsches Datum). Alle weiteren A1-Befund-Codes
 * (DetailViewType, Facetten, Normalisierung) behalten ihre eigene Route und
 * UI.
 *
 * **W1 (Wunschliste 4) — die Fehlergewichtung.** Gemessen am 06.09.2026:
 * 487 von 1.005 Befunden der Library waren `core_fields_missing`, und
 * 465 davon (95,5 %) betrafen AUSSCHLIESSLICH `date`. Alle trugen die
 * Schwere `error` und sperrten die Abnahme von zwoelf Vorhaben — obwohl
 * 371 (76,2 %) unter einem Ordner liegen, dessen Name das Datum traegt, und
 * 348 (71,5 %) Tonaufnahmen sind, bei denen der Dateizeitstempel im Median
 * null Tage danebenliegt. Ein Feld, das die Maschine selbst ableiten kann,
 * ist RUECKSTAND und kein Datenmangel.
 *
 * Deshalb zerfaellt der Befund hier in drei:
 *
 * | Fall                                   | Typ                 | Schwere |
 * |----------------------------------------|---------------------|---------|
 * | Andere Pflichtfelder fehlen (ggf. + `date`) | `core_fields_missing` | error   |
 * | Nur `date`, aber ableitbar             | `datum_ableitbar`   | info    |
 * | Nur `date`, nicht ableitbar            | `datum_fehlt`       | warning |
 *
 * Die Einstufung ist RETROAKTIV: Sie entsteht beim Scan aus Pfad und
 * Dateiname, nicht beim Erschliessen. Die 487 Altbefunde stufen sich also
 * beim naechsten Scan um, ohne dass ein einziger Job neu laufen muss.
 *
 * „Ableitbar" wird NICHT hier entschieden, sondern von denselben reinen
 * Regeln, die die Pipeline benutzt (`external-jobs/datum-aus-pfad`,
 * `datum-aus-datei`). Zwei Parser waeren zwei Wahrheiten: Der Report wuerde
 * etwas versprechen, das der Nachlauf nicht einloest.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { zeitstempelTraegt } from '@/lib/external-jobs/datum-aus-datei'
import { datumAusPfad } from '@/lib/external-jobs/datum-aus-pfad'
import type { DocumentVerificationResult } from '@/lib/library-verification/types'
import { getMediaKindFromName } from '@/lib/media-types'
import type { SourceLocation } from './engine-gaps'
import { createGap } from './gap-registry'
import type { CoverageGap, CoverageGapType } from './types'

/** Das eine Feld, dessen Fehlen eigenstaendig gewichtet wird. */
const DATUMSFELD = 'date'

interface Einstufung {
  type: CoverageGapType
  message: string
  detail: string
}

/**
 * Wie schwer wiegt es, dass nur `date` fehlt? Der Beleg reist als `detail`
 * mit — ohne ihn waere „ableitbar" eine Behauptung.
 */
function stufeDatumEin(pfad: string, name: string): Einstufung {
  const ausPfad = datumAusPfad(pfad)
  if (ausPfad) {
    const genauigkeit = ausPfad.genauigkeit === 'monat' ? ', monatsscharf' : ''
    return {
      type: 'datum_ableitbar',
      message: 'Datum fehlt, steht aber im Ablagepfad',
      detail: `date — ableitbar aus "${ausPfad.segment}": ${ausPfad.datum}${genauigkeit}`,
    }
  }
  if (zeitstempelTraegt(getMediaKindFromName(name))) {
    return {
      type: 'datum_ableitbar',
      message: 'Datum fehlt, ist aber aus dem Dateizeitstempel ableitbar',
      detail: 'date — Ton/Video: Erstellungs- bzw. Aenderungszeitpunkt traegt hier eine Aussage',
    }
  }
  return {
    type: 'datum_fehlt',
    message: 'Datum fehlt und ist nicht ableitbar',
    detail: 'date — weder im Pfad noch im Dateizeitstempel dieses Typs belegt',
  }
}

/** Der Normalfall: mehrere bzw. andere Pflichtfelder fehlen. */
function stufePflichtfelderEin(felder: readonly string[]): Einstufung {
  return {
    type: 'core_fields_missing',
    message: `A0-Pflichtfelder fehlen (${felder.length})`,
    detail: [...felder].sort((a, b) => a.localeCompare(b)).join(', '),
  }
}

/**
 * Uebersetzt die Befund-Dokumente eines A1-Laufs. `fileId` ist die
 * Storage-Datei-Id der QUELLE — dieselbe Id, die der Archiv-Scan liefert;
 * unauffindbare Dokumente haengen an der Wurzel.
 */
export function gapsFromFieldVerification(args: {
  documents: readonly DocumentVerificationResult[]
  locations: ReadonlyMap<string, SourceLocation>
  rootFolderId: string
  /** true bei Teilbaum-Scans — die Feld-Verifikation laeuft library-weit. */
  scoped?: boolean
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const doc of args.documents) {
    const missingFields = doc.issues
      .filter((issue) => issue.code === 'missing-base-field')
      .map((issue) => issue.field ?? '(unbenannt)')
    // W5: ein GESETZTES, aber unplausibles Datum — der Gegenfall zur Luecke.
    const unplausible = doc.issues.filter((issue) => issue.code === 'implausible-date')
    if (missingFields.length === 0 && unplausible.length === 0) continue
    const located = args.locations.get(doc.fileId)
    // Teilbaum-Scope: Dokumente, deren Datei der Scan nicht fand, liegen in
    // ANDEREN Teilbaeumen — sie gehoeren nicht in diesen Report. Das
    // Wurzel-Anheften gilt nur library-weit (Pilot-Befund B2: ein fremdes
    // Dokument klebte an der Wurzel JEDES Teilbaum-Reports).
    if (located === undefined && args.scoped === true) continue
    const name = doc.fileName ?? doc.fileId
    const where = located ?? { folderId: args.rootFolderId, path: name }
    const ort = { scope: 'source' as const, targetId: doc.fileId, targetName: name, folderId: where.folderId, path: where.path }

    if (missingFields.length > 0) {
      const nurDatum = missingFields.length === 1 && missingFields[0] === DATUMSFELD
      const einstufung = nurDatum ? stufeDatumEin(where.path, name) : stufePflichtfelderEin(missingFields)
      gaps.push(createGap({ ...ort, type: einstufung.type, message: einstufung.message, detail: einstufung.detail }))
    }

    // Getrennter Befund, kein Ersatz: „Feld fehlt" und „Feld ist falsch" sind
    // verschiedene Zustaende und gehen an verschiedene Akteure.
    if (unplausible.length > 0) {
      gaps.push(
        createGap({
          ...ort,
          type: 'datum_unplausibel',
          message: unplausible[0].message,
          ...(unplausible.length > 1 ? { detail: `${unplausible.length} Beanstandungen am Feld date` } : {}),
        }),
      )
    }
  }
  return gaps
}
