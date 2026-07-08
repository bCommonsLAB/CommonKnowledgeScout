/**
 * @fileoverview Prompt-/Katalog-Bausteine fuer den LLM-Overlap-Bericht
 * (Plan summen-und-synergie-aggregation, Stufe 3, Todos llm-context-export +
 * llm-overlap-job).
 *
 * @description
 * Pure Funktionen (testbar, kein I/O): Katalog-Tabelle fuer den 1M-Kontext,
 * Auswahl der wirkungsrelevanten Massnahmen, Messages fuer den Faktoren-Pass
 * (Structured Output) und den Prosa-Pass (Bericht). Die GREEDY-Semantik ist
 * konsistent zu Stufe 2: Liste absteigend nach Wirkung sortiert, Faktoren
 * gelten RELATIV zu den weiter oben stehenden (bereits gezaehlten) Massnahmen.
 *
 * @usedIn
 * - src/lib/external-jobs/phase-overlap-report.ts
 * - tests/unit/gallery/overlap-report-prompt.test.ts
 */

import * as z from 'zod'

/** Eine Katalog-Zeile des LLM-Kontexts (ref = stabile Laufnummer der Tabelle). */
export interface OverlapCatalogEntry {
  ref: string
  massnahmeNr?: string
  title: string
  summary?: string
  co2?: number
  kosten?: number
}

/** Zod-Schema des Faktoren-Passes (Structured Output, Zod-validiert). */
export const OverlapFactorsSchema = z.object({
  measures: z.array(
    z.object({
      ref: z.string(),
      faktor_co2: z.number(),
      faktor_kosten: z.number(),
      ueberlappt_mit: z.array(z.string()),
      begruendung: z.string(),
    }),
  ),
})
export type OverlapFactorsResult = z.infer<typeof OverlapFactorsSchema>

/** JSON-Schema (Draft-07) fuer den Secretary Service (Structured Output). */
export const overlapFactorsSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['measures'],
  properties: {
    measures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ref', 'faktor_co2', 'faktor_kosten', 'ueberlappt_mit', 'begruendung'],
        properties: {
          ref: { type: 'string' },
          faktor_co2: { type: 'number', minimum: 0, maximum: 1 },
          faktor_kosten: { type: 'number', minimum: 0, maximum: 1 },
          ueberlappt_mit: { type: 'array', items: { type: 'string' } },
          begruendung: { type: 'string' },
        },
      },
    },
  },
})

/**
 * Waehlt die wirkungsrelevanten Massnahmen: absteigend nach CO2 sortiert
 * (Ties stabil per Titel), gedeckelt auf `maxMeasures`. Massnahmen OHNE
 * CO2-Wert werden separat zurueckgegeben (explizit ausweisen, nie still
 * verwerfen — no-silent-fallbacks). `dropped` = wegen Cap nicht analysiert.
 *
 * Generisch ueber T, damit Zusatzfelder des Aufrufers (z.B. fileId) typsicher
 * durch die Auswahl wandern.
 */
export function selectOverlapMeasures<T extends Omit<OverlapCatalogEntry, 'ref'>>(
  entries: T[],
  maxMeasures: number,
): { selected: Array<T & { ref: string }>; missingCo2: T[]; dropped: number } {
  const withCo2 = entries.filter((e) => typeof e.co2 === 'number' && Number.isFinite(e.co2))
  const missingCo2 = entries.filter((e) => !(typeof e.co2 === 'number' && Number.isFinite(e.co2)))
  const sorted = [...withCo2].sort((a, b) => (b.co2 as number) - (a.co2 as number) || a.title.localeCompare(b.title, 'de'))
  const capped = sorted.slice(0, Math.max(1, maxMeasures))
  return {
    selected: capped.map((e, i) => ({ ...e, ref: String(i + 1) })),
    missingCo2,
    dropped: sorted.length - capped.length,
  }
}

/** Markdown-Katalogtabelle fuer den LLM-Kontext (absteigend nach CO2). */
export function buildOverlapCatalogTable(entries: OverlapCatalogEntry[]): string {
  const lines = [
    '| Ref | Nr | Titel | CO2-Einsparung (kt/Jahr) | Kosten (EUR) | Kurzbeschreibung |',
    '|---|---|---|---|---|---|',
  ]
  for (const e of entries) {
    const summary = (e.summary || '').replace(/\s+/g, ' ').slice(0, 300)
    lines.push(
      `| ${e.ref} | ${e.massnahmeNr ?? '-'} | ${e.title.replace(/\|/g, '/')} | ${e.co2 ?? '-'} | ${e.kosten ?? '-'} | ${summary.replace(/\|/g, '/')} |`,
    )
  }
  return lines.join('\n')
}

const FACTORS_SYSTEM = `Du bist Analyst fuer Klimaschutz-Massnahmenkataloge. Deine Aufgabe ist die
Korrektur von Doppelzaehlung (Policy Overlap): naive Summen ueberschaetzen, weil sich Massnahmen
dieselben Emissionen bzw. Kosten teilen koennen.

Du bekommst eine Tabelle ALLER Massnahmen, absteigend nach CO2-Einsparung sortiert. Vergib pro
Massnahme zwei Korrekturfaktoren in [0..1], jeweils RELATIV zu den Massnahmen WEITER OBEN in der
Tabelle (Greedy: die groesste zaehlt voll und bekommt Faktor 1.0):
- faktor_co2: Anteil der CO2-Einsparung, der NACH Abzug der Ueberschneidung mit bereits
  gezaehlten (weiter oben stehenden) Massnahmen uebrig bleibt. 1.0 = keine Ueberschneidung,
  0.0 = vollstaendig doppelt gezaehlt.
- faktor_kosten: Anteil der Kosten, der bei gemeinsamer Umsetzung mit den ueberlappenden
  Massnahmen zusaetzlich anfaellt (Synergien durch Buendelung, gemeinsame Infrastruktur oder
  Beschaffung senken den Faktor). 1.0 = keine Synergie.

WICHTIG — textliche Aehnlichkeit ist KEINE Ueberlappung: "PV auf Schulen" und "PV auf
Spitaelern" klingen fast identisch, betreffen aber verschiedene Gebaeude — ihre Einsparungen
addieren sich voll (faktor_co2 = 1.0; faktor_kosten ggf. < 1.0 wegen gemeinsamer Beschaffung).
Echte Ueberlappung liegt vor, wenn dieselben Emissionsquellen oder dieselben Investitionen
gemeint sind (z. B. "Sanierungspflicht Landesgebaeude" und "Sanierung Schulgebaeude", wenn
Schulen Landesgebaeude sind).

Regeln:
- ueberlappt_mit: refs der bereits gezaehlten Massnahmen, mit denen sich diese ueberschneidet
  (leer, wenn keine).
- begruendung: EIN kurzer Satz pro Massnahme (warum dieser Faktor).
- Im Zweifel konservativ zaehlen (Faktor NIEDRIGER ansetzen), aber nie unter das fachlich
  Begruendbare.
- Antworte NUR mit JSON nach dem vorgegebenen Schema.`

export interface BuildFactorsMessagesArgs {
  catalogTable: string
  /** refs, fuer die DIESER Pass Faktoren liefern soll (Output-Chunking). */
  sliceRefs: string[]
  /** Optionale Aehnlichkeits-Paare als Pruef-Hinweise ("3 <-> 17 (0.83)"). */
  similarityHints?: string
}

/** Messages fuer einen Faktoren-Pass (Structured Output, ein Output-Slice). */
export function buildOverlapFactorsMessages(args: BuildFactorsMessagesArgs): Array<{ role: 'system' | 'user'; content: string }> {
  const hints = args.similarityHints
    ? `\n\nHinweise aus der Embedding-Aehnlichkeit (textlich aehnliche Paare — pruefe, ob ECHTE\nUeberlappung vorliegt; du darfst darueber hinaus eigene Ueberlappungen erkennen):\n${args.similarityHints}`
    : ''
  const user = `Massnahmen-Katalog (absteigend nach CO2-Einsparung):\n\n${args.catalogTable}${hints}\n\nLiefere jetzt die Faktoren AUSSCHLIESSLICH fuer die Massnahmen mit ref ${args.sliceRefs[0]} bis ${args.sliceRefs[args.sliceRefs.length - 1]} (${args.sliceRefs.length} Stueck, jede genau einmal). Beziehe Ueberlappungen auf ALLE weiter oben stehenden Massnahmen (auch ausserhalb dieses Abschnitts).`
  return [
    { role: 'system', content: FACTORS_SYSTEM },
    { role: 'user', content: user },
  ]
}

// Hinweis: Die Prosa des Berichts laeuft NICHT ueber diesen Chat-Pfad, sondern
// ueber den Secretary-Endpoint /transformer/template mit editierbarem Template
// (User-Entscheid 2026-07-08) — siehe overlap-report-template.ts.
