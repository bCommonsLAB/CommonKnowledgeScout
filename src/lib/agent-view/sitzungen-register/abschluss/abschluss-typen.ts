/**
 * @fileoverview Ein- und Ausgaben von `sitzung_abschliessen` (Plan sitzungen-register, Welle R4).
 *
 * @description
 * Eine Sitzung abschliessen heisst: Beleg pruefen bzw. anlegen, die Zeile im
 * Register anlegen oder ergaenzen (`alt:<Nr>` umschluesseln), die
 * Transformation `chatverlauf-de` starten und den Folgeaufruf fuer nach dem
 * Job nennen. Owner-Entscheide 15.11.: E7 — den Folgeschritt ruft der Skill,
 * das Werkzeug wartet nicht; E8 — grosse Belege nur ueber den Dateiverweis.
 *
 * Fehler sind benannt (`code`), damit der Skill sie unterscheiden kann; alle
 * Pruefungen laufen VOR dem ersten Schreiben.
 *
 * @module agent-view/sitzungen-register/abschluss
 */

import type { SitzungsQuelle, Zugbereich } from '../types'

/** E8: Text im Aufruf nur bis zu dieser Groesse, darueber der Dateiverweis. */
export const BELEG_TEXT_MAX_BYTES = 100 * 1024

export const ABSCHLUSS_FEHLER = [
  'eingabe_ungueltig',
  'beleg_nicht_gefunden',
  'beleg_falscher_ort',
  'beleg_kopf',
  'kennung_abweichend',
  'zuege_abweichend',
  'beleg_zu_gross',
  'name_ungueltig',
  'andere_kennung_am_namen',
  'nr_alt_unbekannt',
  'kennung_vergeben',
  'vorhaben_nicht_gefunden',
] as const
export type AbschlussFehlerCode = (typeof ABSCHLUSS_FEHLER)[number]

export class SitzungsAbschlussError extends Error {
  constructor(readonly code: AbschlussFehlerCode, message: string) {
    super(`${code}: ${message}`)
    this.name = 'SitzungsAbschlussError'
  }
}

/** Wo der Beleg liegt bzw. hin soll: ein Vorhaben oder bewusst keins (`Organisation/Sitzungen`). */
export type AbschlussOrt =
  | { art: 'pfad'; pfad: string }
  | { art: 'folderId'; folderId: string }
  | { art: 'ohneVorhaben' }

/** E8: Text nur fuer kleine Belege; sonst Verweis auf die schon abgelegte Datei. */
export type AbschlussBeleg =
  | { art: 'text'; text: string; name: string }
  | { art: 'pfad'; pfad: string }
  | { art: 'sourceId'; sourceId: string }

export interface AbschlussEingabe {
  libraryId: string
  sitzungId: string
  quelle: SitzungsQuelle
  ort: AbschlussOrt
  beleg: AbschlussBeleg
  /** Nummer der alten Arbeitsliste (z. B. `B45`): `alt:B45` wird auf die Kennung umgeschluesselt. */
  nrAlt: string | null
  /** Library-relative Pfade weiterer Vorhaben (Block auch dort). */
  nebenvorhaben: string[]
  /** Teil-Beleg einer getrennten Sitzung: muss `zuege_von_bis` des Belegs entsprechen. */
  zugbereich: Zugbereich | null
  /** Weglassen = bei ersetztem Beleg erzwingen, sonst entscheidet der Server. */
  erzwingen: boolean | undefined
}

export interface Folgeaufruf {
  werkzeug: string
  argumente: Record<string, unknown>
  wann: string
}

export interface AbschlussErgebnis {
  sitzungId: string
  registerId: string
  beleg: {
    pfad: string | null
    sourceId: string
    ordnerId: string
    bytes: number
    sha256: string
    /** angelegt = neu, ersetzt = gleiche Kennung ueberschrieben, vorhanden = per Verweis uebernommen. */
    aktion: 'angelegt' | 'ersetzt' | 'vorhanden'
  }
  register: {
    aktion: 'angelegt' | 'ergaenzt' | 'unveraendert'
    umgeschluesselt: { von: string; nach: string } | null
    zusammengefuehrt: string | null
    belegNeu: boolean
  }
  transformation:
    | { jobId: string; erzwungen: string; hinweis?: string }
    | { abgesagt: string }
    | { fehler: string }
  /** Stand unmittelbar nach dem Aufruf; die Notiz entsteht erst im Job. */
  stand: 'beleg' | 'notiz'
  folgeaufrufe: Folgeaufruf[]
  hinweise: string[]
}
