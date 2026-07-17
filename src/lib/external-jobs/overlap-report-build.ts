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

/** Prosa-Abschnitte aus dem Template-Transform (flache Frontmatter-Felder). */
export interface ReportProseSections {
  title: string
  themenfelder: string
  groessenordnungen: string
  handlungsempfehlungen: string
}

export interface AssembleReportArgs {
  sections: ReportProseSections
  resultTable: string
  stats: OverlapReportStats
  model: string
  createdAt: Date
  /** Titel der nicht analysierten Massnahmen ohne CO2-Angabe. */
  missingCo2Titles: string[]
}

/** Setzt den vollstaendigen Bericht zusammen (Kopf + Prosa + Tabelle + Grenzen). */
export function assembleOverlapReport(args: AssembleReportArgs): string {
  const missingSection = args.missingCo2Titles.length
    ? `\n\n## Massnahmen ohne CO2-Angabe (nicht analysiert)\n\n` +
      args.missingCo2Titles.map((t) => `- ${t}`).join('\n')
    : ''
  return (
    `# ${args.sections.title}\n\n` +
    `*Stand: ${args.createdAt.toISOString().slice(0, 10)} · Modell: ${args.model} · ` +
    `Alle bereinigten Werte sind SCHAETZUNGEN; die naive Summe ist die Obergrenze.*\n\n` +
    `${buildOverlapStatsText(args.stats)}\n\n` +
    `## Themenfelder\n\n${args.sections.themenfelder.trim()}\n\n` +
    `## Groessenordnungen\n\n${args.sections.groessenordnungen.trim()}\n\n` +
    `## Was jetzt zu tun waere\n\n${args.sections.handlungsempfehlungen.trim()}\n\n` +
    `## Ergebnis-Tabelle\n\n${args.resultTable}` +
    missingSection +
    `\n\n## Methodik und Grenzen\n\n` +
    `Die Faktoren stammen aus einem LLM-Lauf (greedy, absteigend nach Wirkung: jede Massnahme ` +
    `wird relativ zu den bereits gezaehlten bewertet). Auch LLM-Urteile sind Schaetzungen — ` +
    `jede Zeile traegt eine Begruendung und sollte stichprobenartig geprueft werden. ` +
    `Faktor CO2 korrigiert Doppelzaehlung geteilter Emissionen; Faktor Kosten schaetzt ` +
    `Synergien durch Buendelung (gemeinsame Infrastruktur/Beschaffung).`
  )
}
