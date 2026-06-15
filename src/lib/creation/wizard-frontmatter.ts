/**
 * Aufbau des finalen Frontmatters (Schema-Felder) für die Persistenz/Promotion.
 *
 * 1:1 aus `handleSave` (creation-wizard.tsx) herausgelöst, damit BEIDE Pfade
 * dieselbe Quelle nutzen: der (alte) Direkt-Schreibpfad UND die Submission/
 * Inbox (U4) — der Promote-Schritt schreibt `submission.metadata` direkt als
 * Frontmatter, also muss die Submission das *finale* Frontmatter tragen.
 *
 * Regeln (unverändert): hardcodierte Felder (leere description) gewinnen mit dem
 * Template-`rawValue` (LLM darf sie nicht überschreiben); sonst der Formular-/
 * LLM-Wert; sonst der Template-Default. `true`/`false` werden zu Boolean.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md (§E3 Promote)
 */

import type { TemplateMetadataField } from '@/lib/templates/template-types'

type FrontmatterField = Pick<TemplateMetadataField, 'key' | 'description' | 'rawValue'>

function coerceRawValue(rv: string): unknown {
  if (rv === 'true') return true
  if (rv === 'false') return false
  return rv
}

/**
 * Baut das Frontmatter aus den Schema-Feldern + den (bereits inkl. Bild-URLs)
 * zusammengeführten Metadaten. Reihenfolge = Schema-Reihenfolge.
 */
export function buildWizardFrontmatter(
  fields: readonly FrontmatterField[],
  metadataWithImages: Record<string, unknown>,
): Record<string, unknown> {
  const frontmatterKeys = new Set(fields.map((f) => f.key))
  const out: Record<string, unknown> = {}
  for (const key of frontmatterKeys) {
    const field = fields.find((f) => f.key === key)
    const isHardcoded = field && (!field.description || field.description.trim() === '')

    if (isHardcoded && field?.rawValue) {
      // Hardcodiertes Feld: Template-rawValue hat Vorrang (LLM darf nicht überschreiben).
      out[key] = coerceRawValue(field.rawValue)
    } else if (key in metadataWithImages) {
      out[key] = metadataWithImages[key]
    } else {
      // Template-Default: rawValue, wenn das Feld keinen Wert aus Formular/LLM hat.
      const rv = field?.rawValue
      if (rv !== undefined && rv !== '') out[key] = coerceRawValue(rv)
    }
  }
  return out
}
