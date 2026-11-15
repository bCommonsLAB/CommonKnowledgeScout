/**
 * @fileoverview Register-Vorpruefung von `sitzung_abschliessen` (Register, Welle R4). Reine Funktion.
 *
 * @description
 * Plan §6, Schritt 3, VOR jedem Schreiben geprueft: Mit `nrAlt` wird die
 * Altzeile `alt:<Nr>` auf die Kennung umgeschluesselt. Dieselben Regeln wie
 * `sitzung_setzen` (Kennung nachtragen), nur frueher geprueft, damit kein
 * Beleg und kein Job entsteht, wenn das Register danach ablehnen wuerde:
 * - Altzeile fehlt → Fehler, es sei denn, die Kennung traegt die Nummer schon
 *   (zweiter Aufruf, idempotent).
 * - Traegt die Kennung schon eine Zeile mit eigenen Angaben → Fehler; eine
 *   reine Archiv-Zeile wird hineingefuehrt.
 * - Ein bekanntes Kuerzel der Altzeile muss zur Kennung passen.
 *
 * @module agent-view/sitzungen-register/abschluss
 */

import { ALT_PRAEFIX, type SitzungsRegisterDoc } from '../types'
import { istReineArchivZeile } from '../schreib-plaene'
import { SitzungsAbschlussError } from './abschluss-typen'

export interface RegisterVorplan {
  /** registerId der Altzeile, die umgeschluesselt wird; null = keine. */
  umschluesseln: string | null
  hinweise: string[]
}

export function planeRegisterAbschluss(args: {
  sitzungId: string
  nrAlt: string | null
  /** Zeile mit dieser Kennung, falls es sie gibt. */
  bestehend: SitzungsRegisterDoc | null
  /** Zeile `alt:<nrAlt>`, falls es sie gibt. */
  alt: SitzungsRegisterDoc | null
}): RegisterVorplan {
  const { sitzungId, nrAlt, bestehend, alt } = args
  if (nrAlt === null) return { umschluesseln: null, hinweise: [] }
  const altId = `${ALT_PRAEFIX}${nrAlt}`
  if (alt === null) {
    if (bestehend?.nrAlt?.split(', ').includes(nrAlt) === true) {
      return { umschluesseln: null, hinweise: [`${altId} ist schon auf ${sitzungId} umgeschluesselt`] }
    }
    throw new SitzungsAbschlussError('nr_alt_unbekannt', `Register-Zeile ${altId} gibt es nicht (sitzungen_auflisten nennt die Schluessel)`)
  }
  if (alt.kennungPraefix !== undefined && !sitzungId.startsWith(alt.kennungPraefix)) {
    throw new SitzungsAbschlussError('kennung_abweichend', `Kennung ${sitzungId} passt nicht zum Kuerzel ${alt.kennungPraefix} von ${altId}`)
  }
  if (bestehend !== null && bestehend.registerId !== alt.registerId) {
    if (!istReineArchivZeile(bestehend)) {
      throw new SitzungsAbschlussError(
        'kennung_vergeben',
        `Kennung ${sitzungId} traegt schon Zeile ${bestehend.registerId} (gemeldet von ${bestehend.gemeldetVon}) mit eigenen Angaben — ${altId} wird nicht hineingefuehrt`,
      )
    }
    return { umschluesseln: altId, hinweise: [`Archiv-Zeile ${sitzungId} wird in ${altId} hineingefuehrt`] }
  }
  return { umschluesseln: altId, hinweise: [] }
}
