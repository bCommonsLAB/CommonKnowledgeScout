/**
 * @fileoverview Lauf-Option „Slides als Tabelle fuehren" auf die Vorlage anwenden (P6).
 *
 * @description
 * `parameters.slidesAsTable` kommt aus dem Dialog „Aufbereiten & Publizieren"
 * und ist dort nur sichtbar, wenn die Vorlage ein Feld `slides` hat:
 *
 * | Wert        | Wirkung                                                     |
 * |-------------|-------------------------------------------------------------|
 * | `true`      | Vorlage unveraendert (Feld bleibt, Modell fuellt es)        |
 * | `false`     | Feld `slides` fuer diesen Lauf aus dem Frontmatter entfernt |
 * | nicht gesetzt | Vorlage unveraendert (Batch, MCP, aeltere Clients)        |
 *
 * Jede Ausprägung wird als Trace-Attribut gemeldet; `false` ohne Feld in der
 * Vorlage ist kein Fehler, steht aber als `entfernt: false` im Trace.
 *
 * @module external-jobs
 */

import { removeTemplateFrontmatterField, templateHasFrontmatterField } from '@/lib/templates/template-field-check'

/** Frontmatter-Feld der Vorlage, das die Folien-Tabelle traegt. */
export const SLIDES_TEMPLATE_FIELD = 'slides'

export interface SlidesOptionResult {
  content: string
  trace: {
    slidesAsTable: 'true' | 'false' | 'nicht gesetzt'
    feldVorhanden: boolean
    entfernt: boolean
  }
}

export function applySlidesOption(templateContent: string, slidesAsTable: unknown): SlidesOptionResult {
  const feldVorhanden = templateHasFrontmatterField(templateContent, SLIDES_TEMPLATE_FIELD)
  if (slidesAsTable === false) {
    const result = removeTemplateFrontmatterField(templateContent, SLIDES_TEMPLATE_FIELD)
    return { content: result.content, trace: { slidesAsTable: 'false', feldVorhanden, entfernt: result.removed } }
  }
  return {
    content: templateContent,
    trace: { slidesAsTable: slidesAsTable === true ? 'true' : 'nicht gesetzt', feldVorhanden, entfernt: false },
  }
}
