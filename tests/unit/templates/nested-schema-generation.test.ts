/**
 * Tests fuer die verschachtelte Antwortschema-Generierung (Stufe 2).
 *
 * Prueft, dass `serializeTemplateToMarkdown(tpl, false)` Dot-Notation-Keys
 * (z.B. "dominantColor.hex") in ein verschachteltes JSON-Schema aufloest und
 * Array/Number/Boolean-Typen korrekt erkennt. Verifiziert zusaetzlich das
 * reale Template template-samples/Diva-Texture-Analysis.md ("Trockenlauf").
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'
import {
  deserializeTemplateFromMarkdown,
  serializeTemplateToMarkdown,
} from '@/lib/templates/template-service-mongodb'

/** Extrahiert den auto-generierten Schema-Block aus dem Secretary-Markdown. */
function extractSchemaBlock(markdown: string): string {
  const marker = 'Binding response schema'
  const idx = markdown.indexOf(marker)
  expect(idx).toBeGreaterThan(-1)
  return markdown.slice(idx)
}

describe('generateResponseSchemaFromFields — synthetisches Template', () => {
  const content = [
    '---',
    'foo: {{foo|Ein Text}}',
    'nested.a: {{nested.a|Eine aus: x, y}}',
    'nested.b: {{nested.b|Array von Tags}}',
    'nested.deep.c: {{nested.deep.c|Konfidenz als Zahl 0-1}}',
    'flag: {{flag|boolean (true|false)}}',
    '---',
    '',
    'Body',
    '',
    '--- systemprompt',
    'Test-Prompt ohne Schema-Trigger.',
  ].join('\n')

  const tpl = deserializeTemplateFromMarkdown(content, 'synthetic', 'lib', 'u@example.com')
  const md = serializeTemplateToMarkdown(tpl, false)
  const schema = extractSchemaBlock(md)

  it('parst Dot-Notation-Keys als Felder', () => {
    const keys = tpl.metadata.fields.map((f) => f.key)
    expect(keys).toContain('nested.a')
    expect(keys).toContain('nested.deep.c')
  })

  it('verschachtelt Dot-Notation-Keys zu Objekten', () => {
    expect(schema).toContain('"nested": {')
    expect(schema).toContain('"deep": {')
  })

  it('erkennt Array-, Number- und Boolean-Typen', () => {
    expect(schema).toContain('"b": "string[]"')
    expect(schema).toContain('"c": "number | null"')
    expect(schema).toContain('"flag": "boolean"')
  })

  it('behaelt skalare String-Felder mit Beschreibung', () => {
    expect(schema).toContain('"foo": "string (Ein Text)"')
  })
})

describe('Diva-Texture-Analysis.md — Trockenlauf', () => {
  const templatePath = join(process.cwd(), 'template-samples', 'Diva-Texture-Analysis.md')
  const content = readFileSync(templatePath, 'utf-8')

  it('parst ohne Validierungsfehler und hat einen Systemprompt', () => {
    const { template, errors } = parseTemplate(content, 'Diva-Texture-Analysis')
    expect(errors).toEqual([])
    expect(template.systemprompt.trim().length).toBeGreaterThan(50)
    expect(template.metadata.detailViewType).toBe('divaTexture')
  })

  it('extrahiert die neuen Digital-Twin-Felder (Dot-Notation)', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    const keys = template.metadata.fields.map((f) => f.key)
    expect(keys).toContain('materialClass')
    expect(keys).toContain('materialType')
    expect(keys).toContain('dominantColor.hex')
    expect(keys).toContain('availability.scope')
    expect(keys).toContain('availability.retailerILN')
    expect(keys).toContain('visualProperties.surfaceFinish')
    expect(keys).toContain('aiGenerationHints.positivePromptTerms')
    expect(keys).toContain('confidence.needsHumanReview')
  })

  it('System-/Pipeline-Felder sind auskommentiert und KEINE LLM-Felder', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    const keys = template.metadata.fields.map((f) => f.key)
    expect(keys).not.toContain('analysisSourceImage')
    expect(keys).not.toContain('lieferSystemSnapshot')
    expect(keys).not.toContain('groupClassificationId')
    expect(keys).not.toContain('analysisRuns')
    expect(keys).not.toContain('breite_px')
  })

  it('generiert ein verschachteltes Antwortschema mit allen Gruppen', () => {
    const tpl = deserializeTemplateFromMarkdown(content, 'Diva-Texture-Analysis', 'lib', 'u@example.com')
    const md = serializeTemplateToMarkdown(tpl, false)
    const schema = extractSchemaBlock(md)

    // verschachtelte Objekte
    expect(schema).toContain('"dominantColor": {')
    expect(schema).toContain('"availability": {')
    expect(schema).toContain('"visualProperties": {')
    expect(schema).toContain('"aiGenerationHints": {')
    expect(schema).toContain('"confidence": {')

    // Blatt-Felder der visualProperties
    for (const leaf of ['surfaceFinish', 'surfaceRelief', 'patternScale', 'directionality', 'perceivedSoftness', 'colorVariation']) {
      expect(schema).toContain(`"${leaf}":`)
    }

    // Typ-Erkennung
    expect(schema).toContain('"positivePromptTerms": "string[]"')
    expect(schema).toContain('"needsHumanReview": "boolean"')
    expect(schema).toContain('"materialClassConfidence": "number | null"')

    // Top-Level-Klassifikationsfelder
    expect(schema).toContain('"materialClass":')
    expect(schema).toContain('"materialType":')

    // ILN ist ein String (fuehrende Nullen!), NICHT number
    expect(schema).toContain('"iln_nummer": "string')
    expect(schema).not.toContain('"iln_nummer": "number')

    // System-/Pipeline-Felder dürfen NICHT im Schema stehen
    expect(schema).not.toContain('analysisRuns')
    expect(schema).not.toContain('lieferSystemSnapshot')
    expect(schema).not.toContain('detailViewType')
  })
})
