/**
 * Charakter-Tests der generischen Wizard-Vorwärts-Navigation
 * (resolveNextStepIndex, Sub-Welle 3-VI-d / U1). Pinnt die Skip-Regeln, die
 * zuvor inline in handleNext steckten — verhaltenstreu.
 */

import { describe, expect, it } from 'vitest'
import { resolveNextStepIndex } from '@/components/creation-wizard/engine/wizard-navigation'
import type { CreationFlowStepPreset, CreationFlowStepRef } from '@/lib/templates/template-types'

function steps(...presets: CreationFlowStepPreset[]): Pick<CreationFlowStepRef, 'preset'>[] {
  return presets.map((preset) => ({ preset }))
}

const base = { mode: undefined, hasSelectedSource: false, hasGeneratedDraft: false } as const

describe('resolveNextStepIndex — Standardfall', () => {
  it('rückt um genau einen Schritt vor', () => {
    const flow = steps('welcome', 'collectSource', 'editDraft')
    expect(resolveNextStepIndex({ ...base, currentStepIndex: 0 }, flow)).toBe(1)
    expect(resolveNextStepIndex({ ...base, currentStepIndex: 1 }, flow)).toBe(2)
  })
})

describe('resolveNextStepIndex — Form-Modus', () => {
  it('springt zum nächsten editDraft', () => {
    const flow = steps('welcome', 'collectSource', 'generateDraft', 'editDraft')
    // Von welcome (0): collectSource folgt -> NICHT überspringen.
    expect(resolveNextStepIndex({ ...base, mode: 'form', currentStepIndex: 0 }, flow)).toBe(1)
    // Von collectSource (1): überspringt generateDraft bis editDraft (Index 3).
    expect(resolveNextStepIndex({ ...base, mode: 'form', currentStepIndex: 1 }, flow)).toBe(3)
  })

  it('collectSource wird im Form-Modus NIE übersprungen', () => {
    const flow = steps('welcome', 'collectSource', 'editDraft')
    expect(resolveNextStepIndex({ ...base, mode: 'form', currentStepIndex: 0 }, flow)).toBe(1)
  })

  it('ohne nachfolgenden editDraft: normaler Vorlauf', () => {
    const flow = steps('welcome', 'previewDetail')
    expect(resolveNextStepIndex({ ...base, mode: 'form', currentStepIndex: 0 }, flow)).toBe(1)
  })
})

describe('resolveNextStepIndex — Skip-Regeln', () => {
  it('chooseSource wird übersprungen, wenn Quelle gewählt', () => {
    const flow = steps('welcome', 'chooseSource', 'collectSource')
    expect(resolveNextStepIndex({ ...base, hasSelectedSource: true, currentStepIndex: 0 }, flow)).toBe(2)
    expect(resolveNextStepIndex({ ...base, hasSelectedSource: false, currentStepIndex: 0 }, flow)).toBe(1)
  })

  it('generateDraft wird übersprungen, wenn Draft existiert', () => {
    const flow = steps('collectSource', 'generateDraft', 'editDraft')
    expect(resolveNextStepIndex({ ...base, hasGeneratedDraft: true, currentStepIndex: 0 }, flow)).toBe(2)
    expect(resolveNextStepIndex({ ...base, hasGeneratedDraft: false, currentStepIndex: 0 }, flow)).toBe(1)
  })

  it('Skip clamped auf den letzten Index', () => {
    const flow = steps('collectSource', 'generateDraft')
    // generateDraft ist letzter Step; Skip darf nicht über das Ende hinaus.
    expect(resolveNextStepIndex({ ...base, hasGeneratedDraft: true, currentStepIndex: 0 }, flow)).toBe(1)
  })
})
