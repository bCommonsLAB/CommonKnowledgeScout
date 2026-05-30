/**
 * Tests fuer src/lib/diva-texture/review-status.ts (Stufe 3, Update 2).
 *
 * Deckt den Color-Match-Postprocessor + den Override-Schutz fuer den
 * Pass-1-Lifecycle ab. Pure Helfer, keine Mocks noetig.
 */

import { describe, expect, it } from 'vitest'
import {
  applyReviewStatusOverrideGuard,
  buildColorMatchOutcome,
  isReviewStatus,
  type ReviewStatus,
} from '@/lib/diva-texture/review-status'

describe('buildColorMatchOutcome', () => {
  it('ohne Supplier-Preview: match=null, notes leer, vorgeschlagener Status ki_geprueft', () => {
    const out = buildColorMatchOutcome({ color_match_supplier: true, color_match_notes: 'ignored' }, false)
    expect(out.colorMatchSupplier).toBeNull()
    expect(out.colorMatchNotes).toBe('')
    expect(out.proposedReviewStatus).toBe('ki_geprueft')
  })

  it('mit Preview + match=true: notes werden geleert (Edge-Case #22)', () => {
    const out = buildColorMatchOutcome({ color_match_supplier: true, color_match_notes: 'unsinnig' }, true)
    expect(out.colorMatchSupplier).toBe(true)
    expect(out.colorMatchNotes).toBe('')
    expect(out.proposedReviewStatus).toBe('ki_geprueft')
  })

  it('mit Preview + match=false: notes bleiben, Status zu_ueberarbeiten', () => {
    const out = buildColorMatchOutcome(
      { color_match_supplier: false, color_match_notes: 'klar gruener' },
      true,
    )
    expect(out.colorMatchSupplier).toBe(false)
    expect(out.colorMatchNotes).toBe('klar gruener')
    expect(out.proposedReviewStatus).toBe('zu_ueberarbeiten')
  })

  it('akzeptiert String-Booleans "true"/"false"', () => {
    const a = buildColorMatchOutcome({ color_match_supplier: 'true' }, true)
    expect(a.colorMatchSupplier).toBe(true)
    const b = buildColorMatchOutcome({ color_match_supplier: 'false', color_match_notes: 'x' }, true)
    expect(b.colorMatchSupplier).toBe(false)
    expect(b.colorMatchNotes).toBe('x')
  })

  it('ungueltige LLM-Antwort → match=null, kein false-positive Mismatch', () => {
    const out = buildColorMatchOutcome({ color_match_supplier: 'maybe' }, true)
    expect(out.colorMatchSupplier).toBeNull()
    expect(out.proposedReviewStatus).toBe('ki_geprueft')
  })

  it('match=false ohne notes → notes bleibt leer, Status zu_ueberarbeiten', () => {
    const out = buildColorMatchOutcome({ color_match_supplier: false }, true)
    expect(out.colorMatchSupplier).toBe(false)
    expect(out.colorMatchNotes).toBe('')
    expect(out.proposedReviewStatus).toBe('zu_ueberarbeiten')
  })
})

describe('applyReviewStatusOverrideGuard', () => {
  const cases: Array<[ReviewStatus, 'ki_geprueft' | 'zu_ueberarbeiten', ReviewStatus]> = [
    ['nicht_geprueft', 'ki_geprueft', 'ki_geprueft'],
    ['nicht_geprueft', 'zu_ueberarbeiten', 'zu_ueberarbeiten'],
    ['ki_geprueft', 'ki_geprueft', 'ki_geprueft'],
    ['ki_geprueft', 'zu_ueberarbeiten', 'zu_ueberarbeiten'],
    // Manuelle Stati bleiben erhalten:
    ['abgenommen', 'ki_geprueft', 'abgenommen'],
    ['abgenommen', 'zu_ueberarbeiten', 'abgenommen'],
    ['zu_ueberarbeiten', 'ki_geprueft', 'zu_ueberarbeiten'],
    ['zu_ueberarbeiten', 'zu_ueberarbeiten', 'zu_ueberarbeiten'],
  ]

  for (const [existing, proposed, expected] of cases) {
    it(`${existing} + Vorschlag ${proposed} → ${expected}`, () => {
      expect(applyReviewStatusOverrideGuard(existing, proposed)).toBe(expected)
    })
  }
})

describe('isReviewStatus', () => {
  it('erkennt alle vier Enum-Werte', () => {
    expect(isReviewStatus('nicht_geprueft')).toBe(true)
    expect(isReviewStatus('ki_geprueft')).toBe(true)
    expect(isReviewStatus('zu_ueberarbeiten')).toBe(true)
    expect(isReviewStatus('abgenommen')).toBe(true)
  })

  it('lehnt unbekannte Strings + Nicht-Strings ab', () => {
    expect(isReviewStatus('done')).toBe(false)
    expect(isReviewStatus('')).toBe(false)
    expect(isReviewStatus(undefined)).toBe(false)
    expect(isReviewStatus(null)).toBe(false)
    expect(isReviewStatus(1)).toBe(false)
  })
})
