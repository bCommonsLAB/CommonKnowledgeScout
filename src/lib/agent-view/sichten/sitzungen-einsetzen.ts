/**
 * @fileoverview Eine Sitzungs-Zeile in Bericht-Block und Chronik einsetzen (Register, Welle R4b).
 *
 * @description
 * Befund 16.11.2026: Fuer EINE neue Sitzung liefen nach `sitzung_abschliessen`
 * zwei volle Laeufe (352 Ordner, je 90–100 s, ueber der 80-s-Grenze des
 * Geraets), und der Block-Lauf im Teilbaum verlor die Querverweise. Die Zeile
 * hat aber eine feste Form (`sitzungsZeile`), und der Beleg-Name im ersten
 * Wikilink ist eindeutig. Darum hier: bestehende Zeilen lesen, die Zeilen
 * dieses Belegs ersetzen, sortieren wie der volle Lauf (Datum, dann Beleg)
 * und mit denselben Renderern schreiben. Was nicht die erzeugte Form hat,
 * wirft benannt — dann entscheidet der volle Lauf, nicht diese Datei.
 * Reine Funktionen.
 *
 * @module agent-view/sichten
 */

import { berichtMitSitzungenBlock, type AlterBlockStatus } from '../sitzungen-block'
import {
  OHNE_VORHABEN_TITEL, QUERVERWEIS_ENDE, SITZUNGEN_BLOCK_END, SITZUNGEN_BLOCK_START,
  renderChronik, sitzungenBlockAusZeilen, type ChronikGruppe,
} from './sitzungen-render'

/** Datum am Anfang, Beleg im ersten Wikilink — so schreibt `sitzungsZeile` jede Zeile. */
const ZEILE = /^- (\d{4}-\d{2}-\d{2})\b[^[]*\[\[([^\]]+)\]\]/
const CHRONIK_TITEL = '# SITZUNGEN — Chronik der Arbeitssitzungen mit Claude'
const GRUPPE = /^## (.+) \((\d+)\)$/

/** Sortierschluessel einer erzeugten Zeile; null = Zeile hat nicht die erzeugte Form. */
export function zeilenSchluessel(zeile: string): { datum: string; beleg: string } | null {
  const m = ZEILE.exec(zeile)
  return m === null ? null : { datum: m[1], beleg: m[2] }
}

function schluesselOderFehler(zeile: string, wo: string): { datum: string; beleg: string } {
  const s = zeilenSchluessel(zeile)
  if (s === null) throw new Error(`${wo}: Zeile hat nicht die erzeugte Form („${zeile.slice(0, 80)}") — voller Lauf noetig`)
  return s
}

/** Wie `sortiereEintraege`: Datum, dann Beleg-Name (de). */
export function sortiereZeilen(zeilen: readonly string[], wo: string): string[] {
  const mit = zeilen.map((zeile) => ({ zeile, s: schluesselOderFehler(zeile, wo) }))
  mit.sort((a, b) => a.s.datum.localeCompare(b.s.datum) || a.s.beleg.localeCompare(b.s.beleg, 'de'))
  return mit.map((x) => x.zeile)
}

/** Zeilen ohne die dieses Belegs, dazu `neu`; sortiert. */
export function mitZeile(zeilen: readonly string[], beleg: string, neu: string | null, wo: string): string[] {
  const rest = zeilen.filter((zeile) => schluesselOderFehler(zeile, wo).beleg !== beleg)
  return sortiereZeilen(neu === null ? rest : [...rest, neu], wo)
}

export function istQuerverweis(zeile: string): boolean {
  return QUERVERWEIS_ENDE.test(zeile)
}

const QUERVERWEIS_ORT = / \*\(Beleg liegt in ([^\n]*)\)\*$/

/**
 * Teilbaum-Lauf (Befund 16.11.2026, „querverweise 0"): Belege ausserhalb des
 * Scopes sieht der Lauf nicht. Ihre Querverweis-Zeilen bleiben darum stehen,
 * statt still zu verschwinden; der Lauf ueber die ganze Library prueft sie.
 * Liegt der Beleg laut Zeile IM Scope, hat der Lauf ihn gesehen — fehlt er
 * jetzt, gilt der Querverweis als entfallen.
 */
export function fremdeQuerverweise(alteZeilen: readonly string[], neueBelege: ReadonlySet<string>, scopePfad: string): string[] {
  return alteZeilen.filter((zeile) => {
    const s = zeilenSchluessel(zeile)
    const ort = QUERVERWEIS_ORT.exec(zeile)?.[1] ?? null
    if (s === null || ort === null || neueBelege.has(s.beleg)) return false
    return ort !== scopePfad && !ort.startsWith(`${scopePfad}/`)
  })
}

/** Eintrags-Zeilen des erzeugten Blocks; null = kein Marker-Block im Text. */
export function blockZeilen(text: string): string[] | null {
  const start = text.indexOf(SITZUNGEN_BLOCK_START)
  if (start === -1) return null
  const ende = text.indexOf(SITZUNGEN_BLOCK_END, start)
  if (ende === -1) throw new Error(`Start-Marker ${SITZUNGEN_BLOCK_START} ohne Ende-Marker`)
  return text.slice(start, ende).split('\n').filter((zeile) => zeile.startsWith('- '))
}

export type EinsetzStatus = 'geschrieben' | 'unveraendert' | 'kein_block'

export interface BerichtEinsetzErgebnis {
  text: string
  status: EinsetzStatus
  /** `belassen`: daneben steht noch ein handgeschriebener Block — Befund wie im vollen Lauf. */
  alterBlock: AlterBlockStatus | null
}

/**
 * Setzt die Zeile eines Belegs in den Block eines Berichts. Ohne Marker-Block
 * wird NICHT angelegt: welche aelteren Sitzungen dazugehoeren, weiss nur der
 * volle Lauf (`kein_block`).
 */
export function setzeZeileInBericht(text: string, beleg: string, zeile: string, heute: string): BerichtEinsetzErgebnis {
  const alt = blockZeilen(text)
  if (alt === null) return { text, status: 'kein_block', alterBlock: null }
  const neu = mitZeile(alt, beleg, zeile, 'Block')
  if (neu.length === alt.length && neu.every((z, i) => z === alt[i])) return { text, status: 'unveraendert', alterBlock: null }
  const e = berichtMitSitzungenBlock(text, sitzungenBlockAusZeilen(neu, heute), false)
  return { text: e.text, status: e.text === text ? 'unveraendert' : 'geschrieben', alterBlock: e.alterBlock }
}

/** Liest die Abschnitte einer erzeugten Chronik; wirft bei fremder Form. */
export function chronikGruppenLesen(text: string): ChronikGruppe[] {
  if (!text.includes(CHRONIK_TITEL)) throw new Error('SITZUNGEN.md: Titel der erzeugten Chronik fehlt — voller Lauf noetig')
  const zeilen = text.split('\n')
  const ab = zeilen.findIndex((zeile) => zeile.startsWith('## '))
  if (ab === -1) return []
  const gruppen: ChronikGruppe[] = []
  for (const zeile of zeilen.slice(ab)) {
    const g = GRUPPE.exec(zeile)
    if (g !== null) { gruppen.push({ pfad: g[1] === OHNE_VORHABEN_TITEL ? null : g[1], zeilen: [] }); continue }
    if (zeile.trim() === '') continue
    if (!zeile.startsWith('- ')) throw new Error(`SITZUNGEN.md: unerwartete Zeile „${zeile.slice(0, 80)}" — voller Lauf noetig`)
    gruppen[gruppen.length - 1].zeilen.push(zeile)
  }
  return gruppen
}

/** Abschnitte in Archiv-Ordnung (numerisch), „Ohne Vorhaben" zuletzt — wie `gruppiereNachVorhaben`. */
function ordneGruppen(gruppen: ChronikGruppe[]): ChronikGruppe[] {
  return [...gruppen].sort((a, b) => {
    if (a.pfad === null) return b.pfad === null ? 0 : 1
    if (b.pfad === null) return -1
    return a.pfad.localeCompare(b.pfad, 'de', { numeric: true })
  })
}

export interface ChronikEintrag {
  /** Abschnitt: Vorhabenspfad, null = „Ohne Vorhaben". */
  pfad: string | null
  zeile: string
}

/**
 * Ersetzt alle Zeilen eines Belegs in der Chronik durch `eintraege` (Ablage
 * und Querverweise). Leere Abschnitte fallen weg, neue entstehen an ihrem
 * Platz; Zaehler und Kopf rechnet `renderChronik` neu.
 */
export function setzeZeilenInChronik(
  text: string, beleg: string, eintraege: readonly ChronikEintrag[], now: Date,
): { text: string; status: 'geschrieben' | 'unveraendert' } {
  const vorher = chronikGruppenLesen(text)
  const gruppen = vorher
    .map((g) => ({ pfad: g.pfad, zeilen: mitZeile(g.zeilen, beleg, null, 'SITZUNGEN.md') }))
  for (const e of eintraege) {
    const ziel = gruppen.find((g) => g.pfad === e.pfad)
    if (ziel === undefined) gruppen.push({ pfad: e.pfad, zeilen: [e.zeile] })
    else ziel.zeilen = sortiereZeilen([...ziel.zeilen, e.zeile], 'SITZUNGEN.md')
  }
  const neu = ordneGruppen(gruppen.filter((g) => g.zeilen.length > 0))
  const gleich = neu.length === vorher.length && neu.every((g, i) =>
    g.pfad === vorher[i].pfad && g.zeilen.length === vorher[i].zeilen.length && g.zeilen.every((z, j) => z === vorher[i].zeilen[j]))
  return gleich ? { text, status: 'unveraendert' } : { text: renderChronik(neu, now), status: 'geschrieben' }
}
