/**
 * @fileoverview Prompt + Schema für den katalogweiten Beziehungs-LLM-Pass.
 *
 * @description
 * Reine, testbare Bausteine der Quelle-A-Phase (Zielbild §5.1/§5.5): das
 * Zod-/JSON-Schema des strukturierten LLM-Outputs und der Prompt-Aufbau aus
 * dem Katalog (slug/Titel/Summary/Gruppe) plus optionalem Fokus (eine Maßnahme).
 *
 * Generisch: Beziehungstyp (`relationType`, Default „unterstuetzt"), ein
 * optionaler `relationPrompt` (domänenspezifischer Richtungs-Prior, z.B. „struk-
 * turelle/bewusstseinsbildende Maßnahmen wirken auf soziale/wirksame") und ein
 * generisches Gruppen-Label (z.B. die Perspektive aus `colorField`) kommen aus
 * der Per-Library-Config — KEINE Klima-Hardcodierung hier.
 *
 * Strategie (vom Nutzer entschieden): pro Maßnahme der VOLLE Katalog im Kontext;
 * das Modell wählt selbst die wichtigsten unterstützten Maßnahmen aus
 * (Top-N), statt alle-zu-allen zu bewerten. Caching/Vorfilterung folgt als
 * eigene Optimierungswelle.
 */

import * as z from 'zod'

/** Ein einzelner Katalog-Eintrag, der dem LLM angeboten wird. */
export interface RelationsCatalogEntry {
  slug: string
  title: string
  summary?: string
  /** Generischer Klassifikations-/Gruppen-Wert (z.B. `dominant_perspektive`). */
  group?: string
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

/** Default-Obergrenze der wichtigsten ausgehenden Kanten je Maßnahme. */
export const DEFAULT_MAX_OUTGOING = 10

export interface BuildRelationsMessagesArgs {
  catalog: RelationsCatalogEntry[]
  /** Generischer Beziehungstyp (Default „unterstuetzt"). */
  relationType: string
  /** Optionaler, library-spezifischer Richtungs-Prior (freier Text). */
  relationPrompt?: string
  /**
   * Fokus auf EINE Maßnahme: dann nur deren AUSGEHENDE Kanten anfordern
   * (`sourceSlug === focusSlug`). Fehlt der Fokus → ganze Library.
   */
  focusSlug?: string
  /** Obergrenze der wichtigsten ausgehenden Kanten je Maßnahme (Default 10). */
  maxOutgoing?: number
  /** Generischer Name der Gruppen-Dimension (z.B. „Perspektive"), nur Anzeige. */
  groupLabel?: string
}

/** Formatiert eine Katalog-Zeile: `- slug=… [Gruppe] | Titel | Summary`. */
function formatEntry(d: RelationsCatalogEntry): string {
  const group = d.group ? ` [${d.group}]` : ''
  const summary = d.summary ? ` | ${d.summary.slice(0, 280)}` : ''
  return `- slug=${d.slug}${group} | ${d.title}${summary}`
}

/** Baut die system/user-Messages für `callLlmJson`. */
export function buildRelationsMessages(args: BuildRelationsMessagesArgs): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const { catalog, relationType, relationPrompt, focusSlug } = args
  const maxOutgoing = args.maxOutgoing ?? DEFAULT_MAX_OUTGOING
  const groupLabel = args.groupLabel || 'Gruppe'

  const scopeLine = focusSlug
    ? `Betrachte AUSSCHLIESSLICH die Maßnahme mit slug="${focusSlug}". Finde unter allen Dokumenten die wichtigsten (höchstens ${maxOutgoing}), die diese Maßnahme ${relationType} bzw. ermöglicht — sourceSlug MUSS "${focusSlug}" sein.`
    : `Gib je Maßnahme höchstens ${maxOutgoing} ausgehende Kanten zurück — nur die wichtigsten.`

  const hasGroups = catalog.some((d) => d.group)
  const groupHint = hasGroups
    ? `Jeder Eintrag trägt in [eckigen Klammern] seine ${groupLabel}. Nutze sie als Orientierung für die wahrscheinliche Wirkrichtung. Unterstützung kann grundsätzlich in alle Richtungen gehen — die ${groupLabel} ist nur ein Hinweis, keine harte Regel.`
    : ''

  const system = [
    `Du analysierst einen Katalog von Dokumenten und bestimmst gerichtete, gewichtete Beziehungen vom Typ "${relationType}".`,
    `Eine Kante A → B bedeutet: "A ${relationType} B". weight ist die Stärke zwischen 0 und 1.`,
    'Bewerte NICHT alle-zu-allen. Wähle nur die wichtigsten, belastbaren Beziehungen aus; lass schwache/spekulative Kanten weg.',
    'Verwende NUR die unten gelisteten slugs. Erfinde keine slugs.',
    'Gib zu jeder Kante eine kurze, konkrete rationale (ein Satz).',
    scopeLine,
    groupHint,
    relationPrompt ? `Domänen-Hinweis zur Wirkrichtung: ${relationPrompt}` : '',
    'Antworte ausschließlich als JSON gemäß Schema { "edges": [ { "sourceSlug", "targetSlug", "weight", "rationale" } ] }.',
  ].filter(Boolean).join('\n')

  const user = `Dokumente (${catalog.length}):\n${catalog.map(formatEntry).join('\n')}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
