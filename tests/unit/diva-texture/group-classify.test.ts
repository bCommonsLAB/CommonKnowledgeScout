/**
 * Tests fuer src/lib/diva-texture/group-classify.ts (Stufe 4).
 *
 * Deckt pickRepresentative (supplier-preview-Praeferenz, gelockte/verworfene
 * Mitglieder ueberspringen), shouldSkipMember (Edge-Case #6 + #17),
 * extractClassification (Pflichtfelder + ceramic ohne Type) und
 * applyClassificationToMember (Override-Schutz, keine Beruehrung von
 * group_name/availability/locked-Flags).
 */

import { describe, expect, it } from 'vitest'
import {
  applyClassificationToMember,
  classificationFieldsApplied,
  extractClassification,
  pickRepresentative,
  shouldSkipMember,
  type GroupMember,
  type Pass1Classification,
} from '@/lib/diva-texture/group-classify'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

function member(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    fileId: overrides.fileId ?? 'doc-1',
    sourceFileName: overrides.sourceFileName ?? '3_ST_2031_0477_basecolor.jpg',
    classificationLocked: overrides.classificationLocked,
    classificationRejected: overrides.classificationRejected,
    sourceImageChoice: overrides.sourceImageChoice,
  }
}

describe('shouldSkipMember', () => {
  it('akzeptiert Mitglieder ohne Flags', () => {
    expect(shouldSkipMember(member())).toEqual({ skip: false })
  })

  it('skipt gelockte Mitglieder (Edge-Case #6)', () => {
    expect(shouldSkipMember(member({ classificationLocked: true }))).toEqual({
      skip: true,
      reason: 'locked',
    })
  })

  it('skipt verworfene Mitglieder (Edge-Case #17)', () => {
    expect(shouldSkipMember(member({ classificationRejected: true }))).toEqual({
      skip: true,
      reason: 'rejected',
    })
  })

  it('locked gewinnt vor rejected fuer einen stabilen Grund', () => {
    expect(
      shouldSkipMember(member({ classificationLocked: true, classificationRejected: true })),
    ).toEqual({ skip: true, reason: 'locked' })
  })
})

describe('pickRepresentative', () => {
  it('bevorzugt das erste supplier-preview-Mitglied', () => {
    const a = member({ fileId: 'a' })
    const b = member({ fileId: 'b', sourceImageChoice: 'supplier-preview' })
    const c = member({ fileId: 'c', sourceImageChoice: 'supplier-preview' })
    expect(pickRepresentative([a, b, c])?.fileId).toBe('b')
  })

  it('faellt auf das erste nicht-gelockte Mitglied zurueck', () => {
    const a = member({ fileId: 'a' })
    const b = member({ fileId: 'b', sourceImageChoice: 'basecolor' })
    expect(pickRepresentative([a, b])?.fileId).toBe('a')
  })

  it('ueberspringt gelockte und verworfene Mitglieder auch beim supplier-preview-Pfad', () => {
    const locked = member({ fileId: 'a', classificationLocked: true, sourceImageChoice: 'supplier-preview' })
    const rejected = member({ fileId: 'b', classificationRejected: true, sourceImageChoice: 'supplier-preview' })
    const fallback = member({ fileId: 'c' })
    expect(pickRepresentative([locked, rejected, fallback])?.fileId).toBe('c')
  })

  it('liefert null, wenn alle Mitglieder gelockt/verworfen sind', () => {
    expect(
      pickRepresentative([
        member({ classificationLocked: true }),
        member({ classificationRejected: true }),
      ]),
    ).toBeNull()
  })

  it('liefert null bei leerer Liste', () => {
    expect(pickRepresentative([])).toBeNull()
  })
})

describe('extractClassification', () => {
  it('liest die Pflichtfelder aus dem Pass-1-Ergebnis-Markdown', () => {
    const md = [
      '---',
      'material_class: fabric',
      'material_type: cord',
      'confidence_class: 0.95',
      'confidence_type: 0.85',
      'needs_human_review: false',
      '---',
      '',
      'Body',
    ].join('\n')
    expect(extractClassification(md)).toEqual<Pass1Classification>({
      material_class: 'fabric',
      material_type: 'cord',
      confidence_class: 0.95,
      confidence_type: 0.85,
      needs_human_review: false,
    })
  })

  it('akzeptiert ceramic/glass/plastic ohne material_type (confidence_type leer)', () => {
    const md = [
      '---',
      'material_class: ceramic',
      'material_type:',
      'confidence_class: 0.92',
      'confidence_type:',
      'needs_human_review: false',
      '---',
    ].join('\n')
    const result = extractClassification(md)
    expect(result?.material_class).toBe('ceramic')
    expect(result?.material_type).toBe('')
    expect(result?.confidence_type).toBe('')
  })

  it('liefert null, wenn material_class fehlt (kein silent fallback)', () => {
    const md = [
      '---',
      'material_class:',
      'confidence_class: 0.9',
      '---',
    ].join('\n')
    expect(extractClassification(md)).toBeNull()
  })

  it('liefert null, wenn confidence_class fehlt', () => {
    const md = [
      '---',
      'material_class: fabric',
      '---',
    ].join('\n')
    expect(extractClassification(md)).toBeNull()
  })
})

const MEMBER_MD = [
  '---',
  'material_class: ""',
  'material_type: ""',
  'confidence_class: 0',
  'confidence_type: ""',
  'needs_human_review: true',
  'group_name: Feincord',
  'availability_scope: basic',
  'retailer_iln: "0001445679013"',
  'textur_code: ST_2031_0477',
  'classification_locked: true',
  'last_pass: 0',
  '---',
  '',
  'Material body bleibt unveraendert.',
].join('\n')

const CLASSIFICATION: Pass1Classification = {
  material_class: 'fabric',
  material_type: 'cord',
  confidence_class: 0.95,
  confidence_type: 0.85,
  needs_human_review: false,
}

describe('applyClassificationToMember', () => {
  it('schreibt die Klassifikations-Felder ins Frontmatter', () => {
    const patched = applyClassificationToMember(MEMBER_MD, CLASSIFICATION)
    const { meta } = parseFrontmatter(patched)
    expect(meta.material_class).toBe('fabric')
    expect(meta.material_type).toBe('cord')
    expect(meta.confidence_class).toBe(0.95)
    expect(meta.confidence_type).toBe(0.85)
    expect(meta.needs_human_review).toBe(false)
    expect(meta.last_pass).toBe(1)
    expect(meta.pass1_status).toBe('done')
  })

  it('beruehrt classification_locked / group_name / availability NICHT', () => {
    const patched = applyClassificationToMember(MEMBER_MD, CLASSIFICATION)
    const { meta } = parseFrontmatter(patched)
    expect(meta.classification_locked).toBe(true)
    expect(meta.group_name).toBe('Feincord')
    expect(meta.availability_scope).toBe('basic')
    expect(meta.retailer_iln).toBe('0001445679013')
    expect(meta.textur_code).toBe('ST_2031_0477')
  })

  it('belaesst den Body unveraendert', () => {
    const patched = applyClassificationToMember(MEMBER_MD, CLASSIFICATION)
    expect(patched).toContain('Material body bleibt unveraendert.')
  })

  it('uebernimmt needs_human_review=true und setzt pass1_status=needs_review', () => {
    const patched = applyClassificationToMember(MEMBER_MD, {
      ...CLASSIFICATION,
      needs_human_review: true,
    })
    const { meta } = parseFrontmatter(patched)
    expect(meta.needs_human_review).toBe(true)
    expect(meta.pass1_status).toBe('needs_review')
  })

  it('wirft bei leerem Markdown — kein silent fallback', () => {
    expect(() => applyClassificationToMember('', CLASSIFICATION)).toThrow(/Markdown ist leer/)
  })

  it('wirft, wenn das Dokument kein Frontmatter hat', () => {
    expect(() => applyClassificationToMember('Nur Body, kein Frontmatter.', CLASSIFICATION)).toThrow(
      /kein Frontmatter/,
    )
  })
})

describe('classificationFieldsApplied', () => {
  it('listet die Pass-1-Klassifikations-Felder + Pipeline-Status', () => {
    const fields = classificationFieldsApplied()
    expect(fields).toContain('material_class')
    expect(fields).toContain('material_type')
    expect(fields).toContain('confidence_class')
    expect(fields).toContain('confidence_type')
    expect(fields).toContain('needs_human_review')
    expect(fields).toContain('last_pass')
    expect(fields).toContain('pass1_status')
    // Hints und Pass-2-Felder gehoeren NICHT in den Batch
    expect(fields).not.toContain('ai_prompt_positive')
    expect(fields).not.toContain('dominant_color_hex')
  })
})
