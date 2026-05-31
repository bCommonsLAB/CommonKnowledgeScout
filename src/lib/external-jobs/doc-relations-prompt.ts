/**
 * @fileoverview Prompt + Schema für den katalogweiten Beziehungs-LLM-Pass.
 *
 * @description
 * Reine, testbare Bausteine der Quelle-A-Phase (Zielbild §5.1/§5.5): das
 * Zod-/JSON-Schema des strukturierten LLM-Outputs und der Prompt-Aufbau aus
 * dem Katalog (slug/Titel/Summary) plus optionalem Fokus (eine Maßnahme).
 *
 * Generisch: der Beziehungstyp (`relationType`, Default „unterstuetzt") und ein
 * optionaler `relationPrompt` kommen aus der Per-Library-Config — es gibt KEINE
 * Klima-Hardcodierung hier.
 */

import * as z from 'zod'

/** Ein einzelner Katalog-Eintrag, der dem LLM angeboten wird. */
export interface RelationsCatalogEntry {
  slug: string
  title: string
  summary?: string
}

/** Vom LLM gelieferte, slug-basierte Kante (vor der fileId-Auflösung). */
export const RelationsEdgeSchema = z.object({
  sourceSlug: z.string(),
  targetSlug: z.string(),
  weight: z.number(),
  rationale: z.string().optional(),
})

export const RelationsResultSchema = z.object({
  edges: z.array(RelationsEdgeSchema),
})

export type RelationsLlmResult = z.infer<typeof RelationsResultSchema>

/** JSON-Schema (Draft-07) für den Secretary-Structured-Output. */
export const relationsSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceSlug: { type: 'string' },
          targetSlug: { type: 'string' },
          weight: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['sourceSlug', 'targetSlug', 'weight'],
      },
    },
  },
  required: ['edges'],
})

export interface BuildRelationsMessagesArgs {
  catalog: RelationsCatalogEntry[]
  /** Generischer Beziehungstyp (Default „unterstuetzt"). */
  relationType: string
  /** Optionaler, library-spezifischer Zusatz-Prompt. */
  relationPrompt?: string
  /**
   * Fokus auf EINE Maßnahme: dann nur deren AUSGEHENDE Kanten anfordern
   * (`sourceSlug === focusSlug`). Fehlt der Fokus → ganze Library.
   */
  focusSlug?: string
}

/** Baut die system/user-Messages für `callLlmJson`. */
export function buildRelationsMessages(args: BuildRelationsMessagesArgs): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const { catalog, relationType, relationPrompt, focusSlug } = args

  const scopeLine = focusSlug
    ? `Gib AUSSCHLIESSLICH ausgehende Kanten der Maßnahme mit slug="${focusSlug}" zurück (sourceSlug muss "${focusSlug}" sein).`
    : 'Gib die wichtigsten gerichteten Kanten zwischen den Dokumenten zurück.'

  const system = [
    `Du analysierst einen Katalog von Dokumenten und bestimmst gerichtete, gewichtete Beziehungen vom Typ "${relationType}".`,
    `Eine Kante A → B bedeutet: "A ${relationType} B". weight ist die Stärke der Abhängigkeit zwischen 0 und 1.`,
    'Verwende NUR die unten gelisteten slugs. Erfinde keine slugs. Lass schwache/spekulative Kanten weg.',
    'Gib zu jeder Kante eine kurze, konkrete rationale (ein Satz).',
    scopeLine,
    relationPrompt ? `Zusätzliche Vorgabe: ${relationPrompt}` : '',
    'Antworte ausschließlich als JSON gemäß Schema { "edges": [ { "sourceSlug", "targetSlug", "weight", "rationale" } ] }.',
  ].filter(Boolean).join('\n')

  const docList = catalog
    .map((d) => `- slug=${d.slug} | ${d.title}${d.summary ? ` | ${d.summary.slice(0, 280)}` : ''}`)
    .join('\n')

  const user = `Dokumente (${catalog.length}):\n${docList}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
