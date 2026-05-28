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

describe('buildFirstPassFrontmatter — group_name (Stoffgruppe, Stufe 4)', () => {
  it('uebernimmt GroupName aus dem Sidecar-Treffer als group_name', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'fabric' },
      supplierEntry: { VCodex: 'ST_2059-0092', IsTexture: 'True', Material: 'STOFF', GroupName: 'Savanna' },
      filePath: PATH_ILN,
    })
    expect(result.group_name).toBe('Savanna')
  })

  it('group_name ist leer ohne Sidecar-Treffer', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'wood' },
      supplierEntry: null,
      filePath: PATH_ILN,
    })
    expect(result.group_name).toBe('')
  })
})

describe('buildFirstPassFrontmatter — visuelle Properties + Hints (Voll-Pass)', () => {
  it('uebernimmt visuelle Properties und Hints unveraendert aus der LLM-Antwort', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: {
        material_class: 'fabric',
        ai_prompt_positive: 'matte beige corduroy',
        ai_realism_notes: 'show ribs',
        dominant_color_hex: '#585A4E',
        color_family: 'beige',
        surface_finish: 'matte',
        surface_relief: 'subtle',
        pattern_scale: 'fine',
        directionality: 'strong',
        perceived_softness: 'soft',
        color_variation: 'uniform',
        confidence_visual: 0.82,
      },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    })
    // Hints unveraendert
    expect(result.ai_prompt_positive).toBe('matte beige corduroy')
    expect(result.ai_realism_notes).toBe('show ribs')
    // Visuelle Properties werden seit dem Voll-Pass-Modell UEBERNOMMEN
    // (frueher wurden sie hier explizit geleert).
    expect(result.dominant_color_hex).toBe('#585A4E')
    expect(result.color_family).toBe('beige')
    expect(result.surface_finish).toBe('matte')
    expect(result.surface_relief).toBe('subtle')
    expect(result.pattern_scale).toBe('fine')
    expect(result.directionality).toBe('strong')
    expect(result.perceived_softness).toBe('soft')
    expect(result.color_variation).toBe('uniform')
    expect(result.confidence_visual).toBe(0.82)
  })

  it('haelt fehlende visuelle Properties leer (keine undefined ins Frontmatter)', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'fabric' },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    })
    expect(result.dominant_color_hex).toBe('')
    expect(result.surface_finish).toBe('')
    expect(result.confidence_visual).toBe('')
    expect(result.ai_prompt_positive).toBe('')
  })

  it('ist idempotent (gleiche Eingaben → gleiches Ergebnis)', () => {
    const args = {
      llmFields: { material_class: 'fabric', confidence_class: 0.5, dominant_color_hex: '#aabbcc' },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    }
    expect(buildFirstPassFrontmatter(args)).toEqual(buildFirstPassFrontmatter(args))
  })

  it('schreibt analysisSourceImage ins Frontmatter (Snapshot des Quellbilds)', () => {
    const basecolorResult = buildFirstPassFrontmatter({
      llmFields: { material_class: 'fabric' },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
      sourceImage: 'basecolor',
    })
    expect(basecolorResult.analysisSourceImage).toBe('basecolor')

    const supplierResult = buildFirstPassFrontmatter({
      llmFields: { material_class: 'fabric' },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
      sourceImage: 'supplier-preview',
    })
    expect(supplierResult.analysisSourceImage).toBe('supplier-preview')
  })

  it('defaultet analysisSourceImage auf basecolor, wenn der Aufrufer keinen Wert setzt', () => {
    const result = buildFirstPassFrontmatter({
      llmFields: { material_class: 'fabric' },
      supplierEntry: entry('STOFF'),
      filePath: PATH_ILN,
    })
    expect(result.analysisSourceImage).toBe('basecolor')
  })
})
