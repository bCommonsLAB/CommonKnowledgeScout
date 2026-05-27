/**
 * Tests fuer src/lib/diva-texture/first-pass.ts (Stufe 3).
 *
 * Deckt die deterministische Pass-1-Nachbearbeitung ab: Sidecar-Class-Treffer
 * (Confidence 0.95 + Override), Sidecar+LLM-Konflikt, reine Bildklassifikation
 * (Cap 0.8), ceramic ohne Type, unbekanntes Sidecar-Material.
 */

import { describe, expect, it } from 'vitest'
import { buildFirstPassFrontmatter } from '@/lib/diva-texture/first-pass'
import type { OptionvalueEntry } from '@/lib/diva-texture/types'

function entry(material: string): OptionvalueEntry {
  return { VCodex: 'ST_2031-0477', IsTexture: 'True', Material: material, Name: 'Feincord thyme' }
}

const PATH_STANDARD = 'S:\\DIVA3DARCHIV\\DivaStandardMaterials\\textures\\_tex\\3_ST_2031_0477_basecolor.jpg'
const PATH_ILN = 'S:\\DIVA3DARCHIV\\0001445679013\\textures\\_tex\\3_ST_2031_0477_basecolor.jpg'

describe('buildFirstPassFrontmatter — Sidecar-Class-Treffer', () => {
  it('uebernimmt die gemappte Klasse deterministisch + Confidence 0.95', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'fabric', material_type: 'cord', confidence_class: 0.6, confidence_type: 0.7 },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    })
    expect(result.material_class).toBe('fabric')
    expect(result.confidence_class).toBe(0.95)
    expect(result.material_type).toBe('cord')
    expect(result.last_pass).toBe(1)
    expect(result.pass1_status).toBe('done')
    expect(result.retailer_iln).toBe('0001445679013')
    expect(result.availability_scope).toBe('basic')
  })

  it('Sidecar+LLM-Konflikt: Sidecar gewinnt (LLM-Klasse wird ueberschrieben)', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'leather', confidence_class: 0.99 },
      supplierEntry: entry('STOFF'),
      filePath: PATH_STANDARD,
    })
    expect(result.material_class).toBe('fabric')
    expect(result.confidence_class).toBe(0.95)
    expect(result.retailer_iln).toBe('')
  })

  it('KUNSTLEDER → leather + deterministischer material_type faux_leather', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'leather', material_type: 'smooth_leather', confidence_type: 0.9 },
      supplierEntry: entry('KUNSTLEDER'),
      filePath: PATH_ILN,
    })
    expect(result.material_class).toBe('leather')
    expect(result.material_type).toBe('faux_leather')
    expect(result.confidence_class).toBe(0.95)
  })
})

describe('buildFirstPassFrontmatter — reine Bildklassifikation (kein Treffer)', () => {
  it('kappt die LLM-Confidence bei 0.8', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'wood', material_type: 'oak', confidence_class: 0.99, confidence_type: 0.95 },
      supplierEntry: null,
      filePath: PATH_ILN,
    })
    expect(result.material_class).toBe('wood')
    expect(result.confidence_class).toBe(0.8)
    expect(result.confidence_type).toBe(0.95)
  })

  it('fehlende LLM-Confidence → 0 + needs_human_review', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'wood' },
      supplierEntry: null,
      filePath: PATH_ILN,
    })
    expect(result.confidence_class).toBe(0)
    expect(result.needs_human_review).toBe(true)
    expect(result.pass1_status).toBe('needs_review')
  })

  it('unbekanntes Sidecar-Material (isKnown=false) → LLM bestimmt, Cap 0.8', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'stone', confidence_class: 0.9 },
      supplierEntry: entry('BETON'),
      filePath: PATH_ILN,
    })
    expect(result.material_class).toBe('stone')
    expect(result.confidence_class).toBe(0.8)
    expect(Number(result.confidence_class)).toBeLessThan(0.85)
  })
})

describe('buildFirstPassFrontmatter — ceramic/glass/plastic ohne Type', () => {
  it('ceramic: material_type + confidence_type bleiben leer', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'ceramic', material_type: 'porcelain', confidence_class: 0.7, confidence_type: 0.6 },
      supplierEntry: null,
      filePath: PATH_ILN,
    })
    expect(result.material_class).toBe('ceramic')
    expect(result.material_type).toBe('')
    expect(result.confidence_type).toBe('')
  })
})

describe('buildFirstPassFrontmatter — Pass-2-Felder + Hints', () => {
  it('haelt Pass-2-Felder leer und uebernimmt Hints unveraendert', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: {
        material_class: 'fabric',
        ai_prompt_positive: 'matte beige corduroy',
        ai_realism_notes: 'show ribs',
        dominant_color_hex: '#585A4E',
      },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    })
    expect(result.ai_prompt_positive).toBe('matte beige corduroy')
    expect(result.ai_realism_notes).toBe('show ribs')
    // Pass-2-Feld wird NICHT aus llmFields uebernommen, sondern explizit geleert
    expect(result.dominant_color_hex).toBe('')
    expect(result.confidence_visual).toBe('')
  })

  it('ist idempotent (gleiche Eingaben → gleiches Ergebnis)', () => {
    const args = {
      llmFields: { material_class: 'fabric', confidence_class: 0.5 },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    }
    expect(buildFirstPassFrontmatter(args)).toEqual(buildFirstPassFrontmatter(args))
  })
})
