/**
 * Bericht eines Golden-Set-Laufs (Plan `story-status-modalitaet`, m0).
 *
 * Trefferquote je Fragetyp und je Facettenwert (Plan §5 „Ablauf"), getrennt
 * nach deterministischer Ebene und Richter-Ebene. Der Markdown-Bericht ist
 * das, was in den Plan eingetragen wird (Baseline, danach je Hebel). Pure.
 */

import type { GoldenSetFrageErgebnis } from './pruefung'
import type { RichterErgebnis } from './richter'
import type { GoldenSet, GoldenSetFragetyp } from './schema'
import { GOLDEN_SET_FRAGETYPEN } from './schema'

export interface GoldenSetLaufEintrag {
  ergebnis: GoldenSetFrageErgebnis
  /** Fehlt, wenn ohne Richter gefahren wurde. */
  richter?: RichterErgebnis
  /** Erwartete Facettenwerte dieser Frage (metaKey → Werte), für die Quote je Wert. */
  erwarteteWerte: Record<string, string[]>
}

export interface Quote {
  gesamt: number
  deterministischBestanden: number
  richterBestanden?: number
}

export interface GoldenSetBericht {
  gesamt: Quote
  jeTyp: Record<GoldenSetFragetyp, Quote>
  /** `metaKey=wert` → Quote über alle Fragen, die diesen Wert erwarten. */
  jeWert: Record<string, Quote>
  verstoesse: number
  fehlendeDokumente: number
}

function leereQuote(mitRichter: boolean): Quote {
  return mitRichter ? { gesamt: 0, deterministischBestanden: 0, richterBestanden: 0 } : { gesamt: 0, deterministischBestanden: 0 }
}

function zaehle(q: Quote, e: GoldenSetLaufEintrag): void {
  q.gesamt += 1
  if (e.ergebnis.deterministisch.bestanden) q.deterministischBestanden += 1
  if (q.richterBestanden !== undefined && e.richter?.bestanden) q.richterBestanden += 1
}

/** Erwartete Werte einer Frage aus `erwarteteDokumente` (alle Schlüssel außer der Kennung). */
export function erwarteteWerteDerFrage(set: GoldenSet, frageId: string): Record<string, string[]> {
  const frage = set.fragen.find((f) => f.id === frageId)
  if (!frage) throw new Error(`Frage „${frageId}" steht nicht im Golden-Set`)
  const werte: Record<string, Set<string>> = {}
  for (const dok of frage.erwarteteDokumente) {
    for (const [key, wert] of Object.entries(dok)) {
      if (key === set.kennungFeld) continue
      ;(werte[key] ??= new Set()).add(wert)
    }
  }
  return Object.fromEntries(Object.entries(werte).map(([k, v]) => [k, [...v].sort()]))
}

export function baueBericht(eintraege: ReadonlyArray<GoldenSetLaufEintrag>): GoldenSetBericht {
  const mitRichter = eintraege.length > 0 && eintraege.every((e) => e.richter !== undefined)
  const gesamt = leereQuote(mitRichter)
  const jeTyp = Object.fromEntries(GOLDEN_SET_FRAGETYPEN.map((t) => [t, leereQuote(mitRichter)])) as Record<GoldenSetFragetyp, Quote>
  const jeWert: Record<string, Quote> = {}
  let verstoesse = 0
  let fehlendeDokumente = 0
  for (const e of eintraege) {
    zaehle(gesamt, e)
    zaehle(jeTyp[e.ergebnis.typ], e)
    for (const [metaKey, werte] of Object.entries(e.erwarteteWerte)) {
      for (const wert of werte) zaehle((jeWert[`${metaKey}=${wert}`] ??= leereQuote(mitRichter)), e)
    }
    verstoesse += e.ergebnis.deterministisch.verstoesse.length
    fehlendeDokumente += e.ergebnis.deterministisch.dokumente.fehlend.length
  }
  return { gesamt, jeTyp, jeWert, verstoesse, fehlendeDokumente }
}

function quoteText(q: Quote): string {
  const det = `${q.deterministischBestanden}/${q.gesamt}`
  return q.richterBestanden === undefined ? `${det} | –` : `${det} | ${q.richterBestanden}/${q.gesamt}`
}

/** Markdown-Tabellen für den Plan: Zeilen `Bereich | deterministisch | Richter`. */
export function berichtAlsMarkdown(bericht: GoldenSetBericht, titel: string): string {
  const zeilen = [
    `### ${titel}`,
    '',
    '| Bereich | deterministisch | Richter |',
    '|---|---|---|',
    `| gesamt | ${quoteText(bericht.gesamt)} |`,
    ...GOLDEN_SET_FRAGETYPEN.filter((t) => bericht.jeTyp[t].gesamt > 0).map((t) => `| Typ ${t} | ${quoteText(bericht.jeTyp[t])} |`),
    ...Object.entries(bericht.jeWert)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wert, q]) => `| ${wert} | ${quoteText(q)} |`),
    '',
    `Verstöße gegen Verbotslisten: ${bericht.verstoesse}, fehlende erwartete Dokumente: ${bericht.fehlendeDokumente}.`,
  ]
  return zeilen.join('\n')
}
