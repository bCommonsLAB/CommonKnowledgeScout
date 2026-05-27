/**
 * Tests fuer src/lib/diva-texture/material-field-sources.ts (Stufe 2).
 *
 * Prueft die Quellen-Zuordnung (Leas Legende), die Helper sowie die
 * Konsistenz zwischen Quellen-Map und dem flachen Preprocess-Template.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import {
  MATERIAL_FIELD_SOURCES,
  getFieldSource,
  fieldsForSource,
  llmFieldsForPass,
} from '@/lib/diva-texture/material-field-sources'

describe('MATERIAL_FIELD_SOURCES — Zuordnung', () => {
  const cases: Array<[string, string]> = [
    ['title', 'divadata'],
    ['iln_nummer', 'path'],
    ['availability_scope', 'path'],
    ['material_class', 'ai_pass1'],
    ['confidence_class', 'ai_pass1'],
    ['needs_human_review', 'ai_pass1'],
    ['dominant_color_hex', 'ai_pass2'],
    ['surface_finish', 'ai_pass2'],
    ['confidence_visual', 'ai_pass2'],
    ['ai_prompt_positive', 'ai_last_pass'],
    ['ai_realism_notes', 'ai_last_pass'],
    ['last_pass', 'pipeline'],
    ['pass1_status', 'pipeline'],
  ]

  for (const [field, source] of cases) {
    it(`${field} → ${source}`, () => {
      expect(getFieldSource(field)).toBe(source)
    })
  }

  it('liefert undefined fuer unbekannte Felder', () => {
    expect(getFieldSource('does_not_exist')).toBeUndefined()
  })

  it('ceramic/glass/plastic erhalten keinen eigenen material_type-Quell-Sonderfall', () => {
    // material_type ist generisch ai_pass1; die Leer-Regel fuer ceramic/glass/
    // plastic steckt im Template-Prompt, nicht in der Quellen-Map.
    expect(getFieldSource('material_type')).toBe('ai_pass1')
  })
})

describe('fieldsForSource / llmFieldsForPass', () => {
  it('gruppiert Felder nach Quelle', () => {
    expect(fieldsForSource('ai_pass1')).toContain('material_class')
    expect(fieldsForSource('ai_pass2')).toContain('surface_finish')
    expect(fieldsForSource('path')).toContain('iln_nummer')
  })

  it('Pass 1 liefert Klasse/Typ + Hints, NICHT die visuellen Properties', () => {
    const fields = llmFieldsForPass(1)
    expect(fields).toContain('material_class')
    expect(fields).toContain('ai_prompt_positive')
    expect(fields).not.toContain('surface_finish')
  })

  it('Pass 2 liefert visuelle Properties + Hints, NICHT die Klasse', () => {
    const fields = llmFieldsForPass(2)
    expect(fields).toContain('surface_finish')
    expect(fields).toContain('dominant_color_hex')
    expect(fields).toContain('ai_prompt_positive')
    expect(fields).not.toContain('material_class')
  })
})

describe('Konsistenz Quellen-Map ↔ Template', () => {
  it('jedes LLM-Frontmatter-Feld des Templates hat einen Quellen-Eintrag', () => {
    const templatePath = join(process.cwd(), 'template-samples', 'Diva-Texture-Analysis.md')
    const content = readFileSync(templatePath, 'utf-8')
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')

    // Hardcode-Felder ohne Placeholder (sprache/docType/detailViewType) und das
    // Body-Freitextfeld 'analyse' sind keine strukturierten Quell-Felder.
    const llmKeys = template.metadata.fields
      .filter((f) => f.description.trim() !== '')
      .map((f) => f.key)
      .filter((k) => k !== 'analyse')

    for (const key of llmKeys) {
      expect(MATERIAL_FIELD_SOURCES[key], `Quelle fuer "${key}" fehlt`).toBeDefined()
    }
  })
})
