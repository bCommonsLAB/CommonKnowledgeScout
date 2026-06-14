/**
 * Charakter-Tests der `canProceed`-Verdrahtung im Wizard-Kern.
 *
 * Sicherheitsnetz (U0 / Sub-Welle 3-VI-a) VOR der Step-Engine (Sub-Welle 3-VI-d):
 * Die reine Gating-Logik (`canProceedFromStep`) ist bereits in `wizard-flow.test.ts`
 * abgedeckt. Hier pinnen wir die **Komponenten-Naht**, die `wizardState` (+ den
 * separaten `collectSourceCanProceed`-State) in den `WizardProceedContext` mappt
 * und dann den ECHTEN `canProceedFromStep` aufruft.
 *
 * Die Mapping-Funktion unten spiegelt `creation-wizard.tsx` 1:1 (Stand 2026-06-14,
 * dort Zeilen ~4065-4078). Sie ist im Monolithen eine Closure und nicht
 * exportierbar; beim Herauslösen in die Step-Engine (Sub-Welle 3-VI-d) ist dieser
 * Spiegel durch den echten Import zu ersetzen — die Assertions bleiben gültig.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle a, Commit 2)
 */

import { describe, expect, it } from 'vitest'
import { canProceedFromStep } from '@/lib/creation/wizard-flow'
import type { CreationFlowStepPreset } from '@/lib/templates/template-types'

/**
 * Spiegel des `wizardState`-Ausschnitts, den die `canProceed`-Naht liest.
 * Bewusst nur die relevanten Felder (UI-frei), wie die Closure im Kern.
 */
interface WizardStateLike {
  sources: unknown[]
  isExtracting?: boolean
  collectedInput?: { content: string }
  draftText?: string
  hasConfirmedMarkdown?: boolean
  mode?: 'interview' | 'form'
  generatedDraft?: { metadata: Record<string, unknown>; markdown: string }
  isPublishing?: boolean
  isPublished?: boolean
}

/**
 * 1:1-Spiegel von `creation-wizard.tsx` (`canProceed`, ~Z. 4067-4078).
 * `collectSourceCanProceed` ist im Kern ein eigener `useState`, kein Teil von
 * `wizardState` — deshalb hier als separates Argument.
 */
function canProceedFromWizardState(
  preset: CreationFlowStepPreset,
  wizardState: WizardStateLike,
  collectSourceCanProceed: boolean
): boolean {
  return canProceedFromStep(preset, {
    isExtracting: wizardState.isExtracting,
    sourcesCount: wizardState.sources.length,
    collectSourceCanProceed,
    hasCollectedInput: !!wizardState.collectedInput?.content,
    draftText: wizardState.draftText,
    hasConfirmedMarkdown: wizardState.hasConfirmedMarkdown,
    mode: wizardState.mode,
    hasGeneratedDraft: !!wizardState.generatedDraft,
    isPublishing: wizardState.isPublishing,
    isPublished: wizardState.isPublished,
  })
}

function emptyState(overrides: Partial<WizardStateLike> = {}): WizardStateLike {
  return { sources: [], ...overrides }
}

describe('canProceed-Naht — wizardState → Gate (collectSource)', () => {
  it('leerer State: blockiert', () => {
    expect(canProceedFromWizardState('collectSource', emptyState(), false)).toBe(false)
  })

  it('mindestens eine Quelle erlaubt', () => {
    expect(canProceedFromWizardState('collectSource', emptyState({ sources: [{}] }), false)).toBe(true)
  })

  it('separater collectSourceCanProceed-Flag erlaubt auch ohne Quelle', () => {
    expect(canProceedFromWizardState('collectSource', emptyState(), true)).toBe(true)
  })

  it('Legacy collectedInput.content erlaubt; leerer content nicht', () => {
    expect(canProceedFromWizardState('collectSource', emptyState({ collectedInput: { content: 'hallo' } }), false)).toBe(true)
    expect(canProceedFromWizardState('collectSource', emptyState({ collectedInput: { content: '' } }), false)).toBe(false)
  })

  it('laufende Extraktion blockiert trotz Quellen/Flag', () => {
    expect(canProceedFromWizardState('collectSource', emptyState({ sources: [{}], isExtracting: true }), true)).toBe(false)
  })
})

describe('canProceed-Naht — wizardState → Gate (reviewMarkdown / generateDraft / publish)', () => {
  it('reviewMarkdown: braucht draftText UND bestätigtes Markdown', () => {
    expect(canProceedFromWizardState('reviewMarkdown', emptyState({ draftText: '  ' }), false)).toBe(false)
    expect(canProceedFromWizardState('reviewMarkdown', emptyState({ draftText: 'x' }), false)).toBe(false)
    expect(canProceedFromWizardState('reviewMarkdown', emptyState({ draftText: 'x', hasConfirmedMarkdown: true }), false)).toBe(true)
  })

  it('generateDraft: Interview braucht generatedDraft, Form ist frei', () => {
    expect(canProceedFromWizardState('generateDraft', emptyState({ mode: 'interview' }), false)).toBe(false)
    expect(
      canProceedFromWizardState('generateDraft', emptyState({ mode: 'interview', generatedDraft: { metadata: {}, markdown: 'd' } }), false)
    ).toBe(true)
    expect(canProceedFromWizardState('generateDraft', emptyState({ mode: 'form' }), false)).toBe(true)
  })

  it('publish: erst nach isPublished, isPublishing blockiert', () => {
    expect(canProceedFromWizardState('publish', emptyState({ isPublishing: true }), false)).toBe(false)
    expect(canProceedFromWizardState('publish', emptyState(), false)).toBe(false)
    expect(canProceedFromWizardState('publish', emptyState({ isPublished: true }), false)).toBe(true)
  })

  it('immer-erlaubte Presets ignorieren den State', () => {
    for (const p of ['welcome', 'editDraft', 'uploadImages', 'selectRelatedTestimonials', 'previewDetail', 'completion'] as const) {
      expect(canProceedFromWizardState(p, emptyState(), false)).toBe(true)
    }
  })
})
