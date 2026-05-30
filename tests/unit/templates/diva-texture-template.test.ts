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

/**
 * Sucht ein Frontmatter-Feld im geparsten Template. Das Diva-Template duppelt
 * das LLM-Schema NICHT mehr im System-Prompt — der Secretary baut den User-
 * Prompt REQUIRED FIELDS direkt aus diesen `metadata.fields`. Damit ist
 * `fields` jetzt die Single Source of Truth fuer die LLM-Erwartungen.
 */
function findField(
  template: ReturnType<typeof parseTemplate>['template'],
  key: string,
): ReturnType<typeof parseTemplate>['template']['metadata']['fields'][number] | undefined {
  return template.metadata.fields.find((f) => f.key === key)
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
      // Update 2 (2026-05-28): Farbtonabgleich Basecolor vs. Supplier-Preview
      'color_match_supplier',
      'color_match_notes',
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
    for (const key of [
      'last_pass',
      'pass1_status',
      'analysisRuns',
      'lieferSystemSnapshot',
      'breite_px',
      // Update 2: review_status ist Pipeline-Lifecycle (auskommentiert dokumentiert)
      'review_status',
    ]) {
      expect(keys).not.toContain(key)
    }
  })

  it('Stufe-4-Felder sind auskommentiert (NICHT als LLM-Frontmatter-Variable)', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    // group_name kommt deterministisch aus dem Sidecar (Post-Processor) — das LLM
    // soll es nicht halluzinieren (Lea-Regel "Nichts erfinden").
    expect(findField(template, 'group_name')).toBeUndefined()
    // classification_locked/_rejected sind UI-Flags, nicht LLM-Felder.
    expect(findField(template, 'classification_locked')).toBeUndefined()
    expect(findField(template, 'classification_rejected')).toBeUndefined()

    // Aber: im Template dokumentiert (auskommentiert), damit der Klassifizierer
    // weiss, dass die Pipeline diese Felder verwaltet.
    expect(content).toContain('group_name: string')
    expect(content).toContain('classification_locked: boolean')
    expect(content).toContain('classification_rejected: boolean')
  })

  it('Color-Match-Felder erscheinen als LLM-Variable, review_status NICHT (Update 2)', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    // Color-Match-Felder gehoeren ins LLM-Schema (ai_pass1) — als Frontmatter-
    // Placeholder mit {{...|...}}-Token.
    expect(findField(template, 'color_match_supplier')?.description).toBeTruthy()
    expect(findField(template, 'color_match_notes')?.description).toBeTruthy()
    // review_status ist Pipeline-Lifecycle, KEIN LLM-Feld.
    expect(findField(template, 'review_status')).toBeUndefined()
    // Aber im Template als auskommentierter Lifecycle-Hinweis dokumentiert.
    expect(content).toContain('review_status: string')
  })

  it('alle LLM-Frontmatter-Felder sind flach + flach (snake_case, eine Ebene)', () => {
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    // Erwartete LLM-Felder vorhanden, mit nicht-leerer Beschreibung (= sind echte
    // {{variable|description}}-Placeholders, NICHT statische rawValue-Eintraege).
    for (const key of [
      'material_class',
      'dominant_color_hex',
      'surface_finish',
      'ai_prompt_positive',
      'confidence_class',
    ]) {
      const field = findField(template, key)
      expect(field).toBeDefined()
      expect(field?.description?.trim().length).toBeGreaterThan(0)
    }

    // ILN-Variable hat eine String-Typhint-Beschreibung (fuehrende Nullen)
    expect(findField(template, 'iln_nummer')?.description).toMatch(/13-stellig|String/i)

    // Snake_case, keine Dot-Notation, keine verschachtelten Keys
    const llmKeys = template.metadata.fields
      .filter((f) => f.description?.trim().length)
      .map((f) => f.key)
    expect(llmKeys.every((k) => /^[a-z_]+$/.test(k))).toBe(true)

    // System-/Hardcode-Felder NICHT als LLM-Variable
    expect(findField(template, 'analysisRuns')).toBeUndefined()
  })

  it('System-Prompt enthaelt KEIN auto-generiertes Schema (Token-Optimierung)', () => {
    // Der "Antwortschema"-Hinweis im System-Prompt triggert
    // hasHandwrittenResponseSchema → appendGeneratedResponseSchema haengt
    // KEIN auto-generiertes Schema mehr an. Das vollstaendige Schema kommt
    // vom Secretary im User-Prompt als REQUIRED FIELDS (gleiche Quelle:
    // Frontmatter-Variablen). Spart ~3k Tokens pro Lauf.
    const tpl = deserializeTemplateFromMarkdown(content, 'Diva-Texture-Analysis', 'lib', 'u@example.com')
    const md = serializeTemplateToMarkdown(tpl, false)
    expect(md).not.toContain('Binding response schema')
    expect(md).not.toContain('IMPORTANT: Your response must be a valid JSON object where each key')
    // Der Marker-Hinweis MUSS aber im System-Prompt stehen (sonst greift der Schutz nicht).
    expect(md.toLowerCase()).toContain('antwortschema')
  })

  it('serialisiert detailViewType genau einmal ins Frontmatter (kein YAML-Duplikat)', () => {
    // Regression: der Parser nimmt `detailViewType: divaTexture` als generisches
    // field auf, das Serialize-1.5 haengt es ZUSAETZLICH an. Folge waren zwei
    // identische YAML-Zeilen im Output. Jetzt darf jeder Key nur einmal vorkommen.
    const tpl = deserializeTemplateFromMarkdown(content, 'Diva-Texture-Analysis', 'lib', 'u@example.com')
    const md = serializeTemplateToMarkdown(tpl, false)
    const frontmatter = md.split('--- systemprompt')[0] ?? md
    const matches = frontmatter.match(/^detailViewType:\s*\S+/gm) ?? []
    expect(matches).toHaveLength(1)
    expect(matches[0]).toBe('detailViewType: divaTexture')
  })

  it('System-Prompt referenziert die 4-cm-Crop-Strategie (nicht das veraltete ~360 px)', () => {
    // Regression: nach der Crop-Umstellung auf konstant 4 x 4 cm physisch + max
    // 512 px duerfen die alten "Center-Crop, ~360x360 px" und "z.B. \"3.0x3.0\""
    // Beispiele nicht mehr im System-Prompt stehen, sonst widersprechen sie der
    // tatsaechlich vom CONTEXT.basecolor_crop_cm gelieferten Realgroesse.
    const { template } = parseTemplate(content, 'Diva-Texture-Analysis')
    const prompt = template.systemprompt
    expect(prompt).not.toMatch(/360x360/)
    expect(prompt).not.toContain('"3.0x3.0"')
    expect(prompt).toMatch(/4 x 4 cm|4\.0x4\.0/)
  })
})
