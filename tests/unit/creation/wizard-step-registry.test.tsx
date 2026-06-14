/**
 * Tests der Step-Registry (Sub-Welle 3-VI-d / U1, Strangler-Migration).
 *
 * Pinnt: welche Presets bereits auf die Engine migriert sind, dass migrierte
 * Renderer die korrekte Step-Komponente erzeugen, und dass noch nicht migrierte
 * Presets `undefined` liefern (damit der Legacy-Switch im Wizard-Kern greift).
 *
 * Reines Element-Erzeugen (kein Mount) — daher Node-Umgebung ohne jsdom.
 */

import { describe, expect, it } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { renderRegisteredStep, isStepMigrated } from '@/components/creation-wizard/engine/step-registry'
import type { StepRenderContext } from '@/components/creation-wizard/engine/step-render-context'
import type { CreationFlowStepPreset, CreationFlowStepRef } from '@/lib/templates/template-types'
import { WelcomeStep } from '@/components/creation-wizard/steps/welcome-step'
import { CompletionStep } from '@/components/creation-wizard/steps/completion-step'

function ctxFor(step: CreationFlowStepRef): StepRenderContext {
  return {
    template: { name: 'Testvorlage' },
    creation: { welcome: { markdown: '## Hallo' } },
    currentStep: step,
  } as unknown as StepRenderContext
}

describe('Step-Registry — migrierte Presets', () => {
  it('welcome rendert die WelcomeStep-Komponente', () => {
    expect(isStepMigrated('welcome')).toBe(true)
    const node = renderRegisteredStep('welcome', ctxFor({ id: 'W', preset: 'welcome' }))
    expect(isValidElement(node)).toBe(true)
    expect((node as ReactElement).type).toBe(WelcomeStep)
  })

  it('completion rendert die CompletionStep-Komponente', () => {
    expect(isStepMigrated('completion')).toBe(true)
    const node = renderRegisteredStep('completion', ctxFor({ id: 'C', preset: 'completion' }))
    expect((node as ReactElement).type).toBe(CompletionStep)
  })

  it('welcome: step.title gewinnt, sonst Default "Willkommen"', () => {
    const withTitle = renderRegisteredStep('welcome', ctxFor({ id: 'W', preset: 'welcome', title: 'Mein Titel' })) as ReactElement<{ title?: string }>
    expect(withTitle.props.title).toBe('Mein Titel')
    const noTitle = renderRegisteredStep('welcome', ctxFor({ id: 'W', preset: 'welcome' })) as ReactElement<{ title?: string }>
    expect(noTitle.props.title).toBe('Willkommen')
  })

  it('welcome: leeres welcome.markdown fällt auf generierten Default-Text zurück', () => {
    const ctx = { ...ctxFor({ id: 'W', preset: 'welcome' }), creation: { welcome: { markdown: '   ' } } } as unknown as StepRenderContext
    const node = renderRegisteredStep('welcome', ctx) as ReactElement<{ markdown?: string }>
    expect(node.props.markdown).toContain('## Willkommen')
    expect(node.props.markdown).toContain('Testvorlage')
  })

  it('noch nicht migrierte Presets liefern undefined (Legacy-Switch übernimmt)', () => {
    const pending: CreationFlowStepPreset[] = [
      'collectSource',
      'generateDraft',
      'editDraft',
      'uploadImages',
      'selectRelatedTestimonials',
      'selectFolderArtifacts',
      'previewDetail',
      'publish',
      'reviewMarkdown',
    ]
    for (const p of pending) {
      expect(isStepMigrated(p)).toBe(false)
      expect(renderRegisteredStep(p, ctxFor({ id: 'X', preset: p }))).toBeUndefined()
    }
  })
})
