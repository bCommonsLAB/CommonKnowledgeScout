/**
 * @fileoverview `pruefeEinrichtung` und `wendeAntwortenAn` — der Entscheidungskatalog
 * gegen eine Library (Plan speicher-verbindungen-und-library-anlage, C1).
 *
 * @description
 * Reine Funktionen. `pruefeEinrichtung` sagt, welche Pflicht- und empfohlenen
 * Entscheidungen an einer Library offen sind („Einrichtung: n von m");
 * `wendeAntwortenAn` schreibt Antworten der Bruecke (C3) ueber den
 * generischen Antwortweg des Katalogs in die Library — jede Antwort gegen
 * ihr Schema geprueft, unbekannte Schluessel laut abgewiesen.
 *
 * @module library-setup
 */

import type { Library } from '@/types/library'
import { ENTSCHEIDUNGEN, entscheidung } from './entscheidungen'
import { SCHRITTE } from './typen'
import type { EinrichtungsKontext, EinrichtungsLibrary, EinrichtungsPruefung, Entscheidung, EntscheidungsStand, EntscheidungsStatus } from './typen'

function status(e: Entscheidung, library: EinrichtungsLibrary, kontext: EinrichtungsKontext): EntscheidungsStatus {
  if (e.beantwortet(library, kontext)) return 'beantwortet'
  if (e.gewicht !== 'pflicht' && kontext.uebersprungen?.includes(e.schluessel)) return 'uebersprungen'
  return 'offen'
}

function alsStand(e: Entscheidung, s: EntscheidungsStatus): EntscheidungsStand {
  return {
    nr: e.nr, schluessel: e.schluessel, titel: e.titel, frage: e.frage, gewicht: e.gewicht, schritt: e.schritt,
    feldpfade: e.feldpfade, giltWenn: e.giltWenn, vorgabe: e.vorgabe,
    ...(e.optionen ? { optionen: e.optionen } : {}),
    status: s,
    beantwortbar: e.antwort !== undefined,
  }
}

/** Prueft, ob `uebersprungen` nur bekannte, nicht-pflichtige Schluessel nennt. */
export function pruefeUebersprungen(uebersprungen: readonly string[]): void {
  for (const schluessel of uebersprungen) {
    const e = entscheidung(schluessel)
    if (e.gewicht === 'pflicht') throw new Error(`"${schluessel}" ist Pflicht und laesst sich nicht ueberspringen`)
  }
}

/** Stand aller geltenden Entscheidungen an dieser Library. */
export function pruefeEinrichtung(library: EinrichtungsLibrary, kontext: EinrichtungsKontext = {}): EinrichtungsPruefung {
  if (kontext.uebersprungen) pruefeUebersprungen(kontext.uebersprungen)
  const geltend = ENTSCHEIDUNGEN.filter((e) => (e.gilt ? e.gilt(library, kontext) : true))
  const alle = geltend
    .map((e) => alsStand(e, status(e, library, kontext)))
    .sort((a, b) => SCHRITTE.indexOf(a.schritt) - SCHRITTE.indexOf(b.schritt) || a.nr - b.nr)
  const zaehlend = alle.filter((s) => s.gewicht !== 'spaeter')
  const offen = zaehlend.filter((s) => s.status === 'offen')
  return {
    offen,
    erledigt: zaehlend.length - offen.length,
    gesamt: zaehlend.length,
    pflichtOffen: offen.some((s) => s.gewicht === 'pflicht'),
    vollstaendig: offen.length === 0,
    alle,
  }
}

/**
 * Schreibt Antworten (`{ schluessel: wert }`) ueber den Antwortweg des
 * Katalogs in die Library, in Tabellen-Reihenfolge (Facetten vor
 * Antwortregeln, deren Platzhalter auf die Facetten zeigen).
 */
export function wendeAntwortenAn(library: Library, antworten: Readonly<Record<string, unknown>>): Library {
  const schluessel = Object.keys(antworten)
  for (const s of schluessel) {
    const e = entscheidung(s)
    if (!e.antwort) {
      throw new Error(`"${s}" laesst sich hier nicht beantworten — ${e.gewicht === 'pflicht' ? 'eigener Parameter' : 'in den Settings setzen oder ueberspringen'}`)
    }
  }
  let ergebnis = library
  for (const e of ENTSCHEIDUNGEN) {
    if (!e.antwort || !(e.schluessel in antworten)) continue
    const geprueft = e.antwort.schema.safeParse(antworten[e.schluessel])
    if (!geprueft.success) {
      throw new Error(`Antwort "${e.schluessel}" ungueltig: ${geprueft.error.issues.map((i) => i.message).join('; ')}`)
    }
    ergebnis = e.antwort.anwenden(ergebnis, geprueft.data)
  }
  return ergebnis
}
