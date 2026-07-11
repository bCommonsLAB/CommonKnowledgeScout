/**
 * @fileoverview Deterministische Bausteine des LLM-Overlap-Berichts:
 * bereinigte Summen, Ergebnis-Tabelle und Bericht-Assembly (Markdown).
 *
 * Die ZAHLEN rechnet ausschliesslich dieser Code — das LLM liefert nur
 * Faktoren (Structured Output) und Prosa. So koennen keine LLM-Rechenfehler
 * in die Summen einfliessen (Plan Stufe 3, Todo llm-report-output).
 */

import type { OverlapCatalogEntry } from './overlap-report-prompt'
import type { OverlapReportStats } from '@/lib/repositories/overlap-report-repo'

/** Validierter Faktor-Satz einer Massnahme (nach Zod + Clamping). */
export interface AppliedFactors {
  faktorCo2: number
  faktorKosten: number
  ueberlapptMit: string[]
  begruendung: string
}

const fmt = (v: number): string => v.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/**
 * Rechnet naive und bereinigte Summen. Massnahmen OHNE Faktor (LLM hat sie
 * nicht geliefert) fliessen mit vollem Wert ein — die naive Summe bleibt so
 * die Obergrenze — und werden explizit gezaehlt (kein stilles Mischen).
 */
export function computeOverlapTotals(
  entries: OverlapCatalogEntry[],
  factorsByRef: Map<string, AppliedFactors>,
): Pick<OverlapReportStats, 'naiveCo2' | 'adjustedCo2' | 'naiveKosten' | 'adjustedKosten' | 'withoutFactor'> {
  let naiveCo2 = 0
  let adjustedCo2 = 0
  let naiveKosten = 0
  let adjustedKosten = 0
  let withoutFactor = 0
  for (const e of entries) {
    const f = factorsByRef.get(e.ref)
    if (!f) withoutFactor += 1
    if (typeof e.co2 === 'number') {
      naiveCo2 += e.co2
      adjustedCo2 += e.co2 * (f ? f.faktorCo2 : 1)
    }
    if (typeof e.kosten === 'number') {
      naiveKosten += e.kosten
      adjustedKosten += e.kosten * (f ? f.faktorKosten : 1)
    }
  }
  return { naiveCo2, adjustedCo2, naiveKosten, adjustedKosten, withoutFactor }
}

/** Ergebnis-Tabelle (Markdown) inkl. Summenzeile — Zahlenformat de-DE. */
export function buildOverlapResultTable(
  entries: OverlapCatalogEntry[],
  factorsByRef: Map<string, AppliedFactors>,
): string {
  const totals = computeOverlapTotals(entries, factorsByRef)
  const lines = [
    '| Nr | Titel | CO2 (kt) | Faktor CO2 | CO2 bereinigt | Kosten (EUR) | Faktor Kosten | Kosten bereinigt | Überlappt mit | Begründung |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ]
  for (const e of entries) {
    const f = factorsByRef.get(e.ref)
    const co2Adj = typeof e.co2 === 'number' ? e.co2 * (f ? f.faktorCo2 : 1) : undefined
    const kostenAdj = typeof e.kosten === 'number' ? e.kosten * (f ? f.faktorKosten : 1) : undefined
    lines.push(
      `| ${e.massnahmeNr ?? e.ref} | ${e.title.replace(/\|/g, '/')} ` +
        `| ${typeof e.co2 === 'number' ? fmt(e.co2) : '–'} ` +
        `| ${f ? fmt(f.faktorCo2) : 'ohne Faktor'} ` +
        `| ${co2Adj !== undefined ? fmt(co2Adj) : '–'} ` +
        `| ${typeof e.kosten === 'number' ? fmt(e.kosten) : '–'} ` +
        `| ${f ? fmt(f.faktorKosten) : 'ohne Faktor'} ` +
        `| ${kostenAdj !== undefined ? fmt(kostenAdj) : '–'} ` +
        `| ${f && f.ueberlapptMit.length ? f.ueberlapptMit.join(', ') : '–'} ` +
        `| ${(f?.begruendung ?? '–').replace(/\|/g, '/').replace(/\s+/g, ' ')} |`,
    )
  }
  lines.push(
    `| **Summe** |  | **${fmt(totals.naiveCo2)}** |  | **${fmt(totals.adjustedCo2)}** ` +
      `| **${fmt(totals.naiveKosten)}** |  | **${fmt(totals.adjustedKosten)}** |  |  |`,
  )
  return lines.join('\n')
}

/** Kennzahlen-Text fuer den Prosa-Pass und den Bericht-Kopf. */
export function buildOverlapStatsText(stats: OverlapReportStats): string {
  const lines = [
    `- Analysierte Massnahmen: ${stats.measures}`,
    `- CO2-Einsparung naiv (Obergrenze): ${fmt(stats.naiveCo2)} kt/Jahr — bereinigt (Schaetzung): ${fmt(stats.adjustedCo2)} kt/Jahr`,
    `- Kosten naiv: ${fmt(stats.naiveKosten)} EUR — synergiebereinigt (Schaetzung): ${fmt(stats.adjustedKosten)} EUR`,
  ]
  if (stats.missingCo2 > 0) lines.push(`- Ohne CO2-Angabe (nicht analysiert): ${stats.missingCo2}`)
  if (stats.dropped > 0) lines.push(`- Wegen Obergrenze nicht analysiert: ${stats.dropped}`)
  if (stats.withoutFactor > 0) lines.push(`- Ohne LLM-Faktor (voll gezaehlt): ${stats.withoutFactor}`)
  return lines.join('\n')
}

/**
 * "Ohne Angabe"-Abschnitt als Body-Variable ({{ohne_angabe}}) — leerer String,
 * wenn alle Massnahmen einen CO2-Wert haben. Das Bericht-LAYOUT kommt seit
 * 2026-07-11 aus dem Template-Body (renderTemplateBody), nicht mehr aus Code.
 */
export function buildMissingCo2Section(titles: string[]): string {
  if (titles.length === 0) return ''
  return (
    `## Massnahmen ohne CO2-Angabe (nicht analysiert)\n\n` +
    titles.map((t) => `- ${t}`).join('\n')
  )
}
