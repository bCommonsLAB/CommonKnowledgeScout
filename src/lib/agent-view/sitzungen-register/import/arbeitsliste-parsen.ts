/**
 * @fileoverview Arbeitsliste „Sitzungen nachtragen" lesen (Plan sitzungen-register, R2). Reine Funktion.
 *
 * @description
 * Die Liste ist seit 08.11.2026 nach Vorhaben gegliedert: unter
 * `## Sitzungen nach Vorhaben` je Vorhaben ein `### <Bereich/Vorhaben> (N, davon M abgeschlossen)`
 * und darin EINE Tabellenform:
 * `| Erl. | Nr | Beginn | Ende | Titel | Quelle | Repo · Branch/PR · Link | Bemerkung |`.
 * Die Nummer traegt den alten Teil (A Code lokal, B Cowork/Chat 2026, C Chat 2024/25,
 * D Code Cloud). Nur dieser Bereich wird gelesen; Tabellen der Nachtraege davor
 * nicht. Jede Zeile, die nicht in die Form passt, wird Fehler mit Zeilennummer —
 * nie still uebersprungen.
 *
 * @module agent-view/sitzungen-register/import
 */

export const LISTEN_BEREICH = '## Sitzungen nach Vorhaben'

export interface ListenZeile {
  /** 1-basierte Zeilennummer in der Datei. */
  zeile: number
  /** Ueberschrift des Abschnitts ohne Zaehler, z. B. `6. bCommonsLab prototyping/24.09 KnowledgeScout`. */
  abschnitt: string
  erledigt: boolean
  /** Alte Nummer, z. B. `B45`. */
  nr: string
  beginn: string | null
  /** `~` am Datum: vom Nachbarn geschaetzt. */
  beginnGeschaetzt: boolean
  ende: string | null
  titel: string
  quelleRoh: string
  repoRoh: string
  bemerkung: string
}

export interface ParseFehler {
  zeile: number
  grund: string
}

export interface ParseErgebnis {
  zeilen: ListenZeile[]
  fehler: ParseFehler[]
  abschnitte: string[]
}

const ABSCHNITT = /^### (.+?)(?: \(\d+, davon \d+ abgeschlossen\))?\s*$/
const DATUM = /^(\d{4}-\d{2}-\d{2})(~?)$/
const NR = /^[ABCD]\d+$/
const TRENNER = /^:?-{3,}:?$/

/** `| a | b |` → `['a', 'b']`; `\|` bleibt als `|` im Zelltext. */
export function zellen(zeile: string): string[] {
  const innen = zeile.trim().replace(/^\|/, '').replace(/\|$/, '')
  return innen.split(/(?<!\\)\|/).map((z) => z.replace(/\\\|/g, '|').trim())
}

function datum(roh: string): { iso: string | null; geschaetzt: boolean } | null {
  if (roh === '') return { iso: null, geschaetzt: false }
  const m = roh.match(DATUM)
  return m ? { iso: m[1], geschaetzt: m[2] === '~' } : null
}

export function parseArbeitsliste(text: string): ParseErgebnis {
  const ergebnis: ParseErgebnis = { zeilen: [], fehler: [], abschnitte: [] }
  let imBereich = false
  let abschnitt: string | null = null
  text.split(/\r?\n/).forEach((roh, index) => {
    const nummer = index + 1
    if (roh.startsWith('## ')) {
      imBereich = roh.trim() === LISTEN_BEREICH
      abschnitt = null
      return
    }
    if (!imBereich) return
    const kopf = roh.match(ABSCHNITT)
    if (kopf) {
      abschnitt = kopf[1].trim()
      ergebnis.abschnitte.push(abschnitt)
      return
    }
    if (!roh.trimStart().startsWith('|')) return
    const z = zellen(roh)
    if (z[0] === 'Erl.' || TRENNER.test(z[0])) return
    const fehler = (grund: string) => ergebnis.fehler.push({ zeile: nummer, grund })
    if (abschnitt === null) return fehler('Tabellenzeile vor dem ersten Abschnitt')
    if (z.length !== 8) return fehler(`${z.length} statt 8 Spalten`)
    const [erl, nr, beginnRoh, endeRoh, titel, quelleRoh, repoRoh, bemerkung] = z
    if (erl !== '[x]' && erl !== '[ ]') return fehler(`Spalte Erl. „${erl}" ist weder [x] noch [ ]`)
    if (!NR.test(nr)) return fehler(`Nummer „${nr}" passt nicht zu A/B/C/D + Zahl`)
    const beginn = datum(beginnRoh)
    const ende = datum(endeRoh)
    if (beginn === null) return fehler(`Beginn „${beginnRoh}" ist kein Datum`)
    if (ende === null) return fehler(`Ende „${endeRoh}" ist kein Datum`)
    if (titel === '') return fehler('Titel leer')
    ergebnis.zeilen.push({
      zeile: nummer, abschnitt, erledigt: erl === '[x]', nr,
      beginn: beginn.iso, beginnGeschaetzt: beginn.geschaetzt, ende: ende.iso,
      titel, quelleRoh, repoRoh, bemerkung,
    })
  })
  return ergebnis
}
