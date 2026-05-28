/**
 * Tests fuer das flache DIVA-Texture-Preprocess-Template (Stufe 2).
 *
 * Prueft, dass template-samples/Diva-Texture-Analysis.md ein FLACHES,
 * Obsidian-kompatibles Frontmatter hat (snake_case, eine Ebene, keine
 * Dot-Notation) und dass das auto-generierte Antwortschema flach bleibt.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import {
  deserializeTemplateFromMarkdown,
  serializeTemplateToMarkdown,
} from '@/lib/templates/template-service-mongodb'

const templatePath = join(process.cwd(), 'template-samples', 'Diva-Texture-Analysis.md')
const content = readFileSync(templatePath, 'utf-8')

/** Extrahiert den auto-generierten Schema-Block aus dem Secretary-Markdown. */
function extractSchemaBlock(markdown: string): string {
  const marker = 'Binding response schema'
  const idx = markdown.indexOf(marker)
  expect(idx).toBeGreaterThan(-1)
  return markdown.slice(idx)
}

describe('Diva-Texture-Analysis.md — Struktur', () => {
  it('parst ohne Validierungsfehler und hat einen Systemprompt', () => {
    const { template, errors } = parseTemplate(content, 'Diva-Texture-Analysis')
    expect(errors).toEqual([])
    expect(template.systemprompt.trim().length).toBeGreaterThan(50)
    expect(template.metadata.detailViewType).toBe('divaTexture')
  })

  it('enthaelt die flachen snake_case-Felder', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    const keys = template.metadata.fields.map((f) => f.key)
    for (const key of [
      'material_class',
      'material_type',
      'dominant_color_hex',
      'availability_scope',
      'retailer_iln',
      'surface_finish',
      'ai_prompt_positive',
      'confidence_class',
      'confidence_visual',
      'needs_human_review',
    ]) {
      expect(keys).toContain(key)
    }
  })

  it('hat KEINE Dot-Notation-Keys (flaches Frontmatter)', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    const dottedKeys = template.metadata.fields.map((f) => f.key).filter((k) => k.includes('.'))
    expect(dottedKeys).toEqual([])
  })

  it('System-/Pipeline-Felder sind auskommentiert und KEINE LLM-Felder', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    const keys = template.metadata.fields.map((f) => f.key)
    for (const key of ['last_pass', 'pass1_status', 'analysisRuns', 'lieferSystemSnapshot', 'breite_px']) {
      expect(keys).not.toContain(key)
    }
  })

  it('Stufe-4-Felder sind auskommentierte Pipeline-Felder (NICHT im LLM-Schema)', () => {
    const tpl = deserializeTemplateFromMarkdown(content, 'Diva-Texture-Analysis', 'lib', 'u@example.com')
    const md = serializeTemplateToMarkdown(tpl, false)
    const schema = extractSchemaBlock(md)
    // group_name kommt deterministisch aus dem Sidecar (Post-Processor) — das LLM
    // soll es nicht halluzinieren (Lea-Regel "Nichts erfinden").
    expect(schema).not.toContain('"group_name":')
    // classification_locked/_rejected sind UI-Flags, nicht LLM-Felder.
    expect(schema).not.toContain('"classification_locked":')
    expect(schema).not.toContain('"classification_rejected":')

    // Aber: im Template dokumentiert (auskommentiert), damit der Klassifizierer
    // weiss, dass die Pipeline diese Felder verwaltet.
    expect(content).toContain('group_name: string')
    expect(content).toContain('classification_locked: boolean')
    expect(content).toContain('classification_rejected: boolean')
  })

  it('generiert ein FLACHES Antwortschema (keine verschachtelten Objekte)', () => {
    const tpl = deserializeTemplateFromMarkdown(content, 'Diva-Texture-Analysis', 'lib', 'u@example.com')
    const md = serializeTemplateToMarkdown(tpl, false)
    const schema = extractSchemaBlock(md)

    // Flache Keys vorhanden
    expect(schema).toContain('"material_class":')
    expect(schema).toContain('"dominant_color_hex":')
    expect(schema).toContain('"surface_finish":')

    // Typ-Erkennung
    expect(schema).toContain('"ai_prompt_positive": "string[]"')
    expect(schema).toContain('"confidence_class": "number | null"')

    // ILN bleibt String (fuehrende Nullen!)
    expect(schema).toContain('"iln_nummer": "string')
    expect(schema).not.toContain('"iln_nummer": "number')

    // KEINE verschachtelten Container des alten Modells
    for (const nested of ['"visualProperties": {', '"aiGenerationHints": {', '"confidence": {', '"dominantColor": {']) {
      expect(schema).not.toContain(nested)
    }

    // System-/Hardcode-Felder nicht im Schema
    expect(schema).not.toContain('analysisRuns')
    expect(schema).not.toContain('detailViewType')
  })
})
