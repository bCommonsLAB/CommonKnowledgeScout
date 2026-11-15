/**
 * @fileoverview Flache Werkzeug-Argumente von `sitzung_abschliessen` lesen (Register, Welle R4). Reine Funktion.
 *
 * @description
 * Das Brueckenschema ist flach (MCP-Werkzeuge kennen keine Unions gut); hier
 * wird daraus die getypte Eingabe. Je Gruppe genau EIN Weg — Ort (Pfad,
 * folderId oder `ohneVorhaben`) und Beleg (Text mit Name, Pfad oder
 * sourceId). Zwei Wege oder keiner sind ein benannter Fehler, kein stiller
 * Vorrang. E8: Text ueber {@link BELEG_TEXT_MAX_BYTES} wird abgewiesen.
 *
 * @module agent-view/sitzungen-register/abschluss
 */

import { belegNameLesen } from '@/lib/agent-view/sichten/sitzungen-types'
import { pruefeKennung } from '../schreib-plaene'
import type { SitzungsQuelle, Zugbereich } from '../types'
import {
  BELEG_TEXT_MAX_BYTES, SitzungsAbschlussError,
  type AbschlussBeleg, type AbschlussEingabe, type AbschlussOrt,
} from './abschluss-typen'

export interface AbschlussRoh {
  libraryId: string
  sitzungId: string
  quelle: SitzungsQuelle
  vorhabenPfad?: string
  vorhabenFolderId?: string
  ohneVorhaben?: boolean
  belegText?: string
  belegName?: string
  belegPfad?: string
  belegSourceId?: string
  nrAlt?: string
  nebenvorhaben?: string[]
  zugbereich?: Zugbereich
  erzwingen?: boolean
}

function genauEins(gruppe: string, wege: Array<[string, boolean]>): string {
  const gesetzt = wege.filter(([, da]) => da).map(([name]) => name)
  if (gesetzt.length !== 1) {
    throw new SitzungsAbschlussError('eingabe_ungueltig', `${gruppe}: genau einer von ${wege.map(([n]) => n).join(', ')} (angegeben: ${gesetzt.join(', ') || 'keiner'})`)
  }
  return gesetzt[0]
}

function leseOrt(r: AbschlussRoh): AbschlussOrt {
  const weg = genauEins('Ort', [['vorhabenPfad', r.vorhabenPfad !== undefined], ['vorhabenFolderId', r.vorhabenFolderId !== undefined], ['ohneVorhaben', r.ohneVorhaben === true]])
  if (weg === 'vorhabenPfad') return { art: 'pfad', pfad: r.vorhabenPfad as string }
  if (weg === 'vorhabenFolderId') return { art: 'folderId', folderId: r.vorhabenFolderId as string }
  return { art: 'ohneVorhaben' }
}

function leseBeleg(r: AbschlussRoh): AbschlussBeleg {
  const weg = genauEins('Beleg', [['belegText', r.belegText !== undefined], ['belegPfad', r.belegPfad !== undefined], ['belegSourceId', r.belegSourceId !== undefined]])
  if (weg === 'belegPfad') return { art: 'pfad', pfad: r.belegPfad as string }
  if (weg === 'belegSourceId') return { art: 'sourceId', sourceId: r.belegSourceId as string }
  const text = r.belegText as string
  const bytes = Buffer.byteLength(text, 'utf-8')
  if (bytes > BELEG_TEXT_MAX_BYTES) {
    throw new SitzungsAbschlussError('beleg_zu_gross', `Beleg-Text hat ${bytes} Bytes (Grenze ${BELEG_TEXT_MAX_BYTES}). Datei ueber den Speicher ablegen und belegPfad angeben`)
  }
  const name = r.belegName
  if (name === undefined) throw new SitzungsAbschlussError('eingabe_ungueltig', 'belegText braucht belegName (JJJJ-MM-TT Code|Chat <Titel>.md)')
  if (name.includes('/') || belegNameLesen(name) === null) {
    throw new SitzungsAbschlussError('name_ungueltig', `„${name}" ist kein Beleg-Name (JJJJ-MM-TT Code|Chat <Titel>.md, ohne Ordner)`)
  }
  return { art: 'text', text, name }
}

export function leseAbschlussEingabe(r: AbschlussRoh): AbschlussEingabe {
  try {
    pruefeKennung(r.sitzungId)
  } catch (error) {
    throw new SitzungsAbschlussError('eingabe_ungueltig', error instanceof Error ? error.message : String(error))
  }
  if (r.zugbereich !== undefined && (r.zugbereich.von < 1 || r.zugbereich.bis < r.zugbereich.von)) {
    throw new SitzungsAbschlussError('eingabe_ungueltig', `Zugbereich ${r.zugbereich.von}-${r.zugbereich.bis} ungueltig (von ≥ 1, bis ≥ von)`)
  }
  const nrAlt = r.nrAlt?.trim()
  if (nrAlt === '') throw new SitzungsAbschlussError('eingabe_ungueltig', 'nrAlt ist leer — weglassen oder die Nummer der Arbeitsliste nennen (z. B. B45)')
  return {
    libraryId: r.libraryId,
    sitzungId: r.sitzungId,
    quelle: r.quelle,
    ort: leseOrt(r),
    beleg: leseBeleg(r),
    nrAlt: nrAlt ?? null,
    nebenvorhaben: r.nebenvorhaben ?? [],
    zugbereich: r.zugbereich ?? null,
    erzwingen: r.erzwingen,
  }
}
