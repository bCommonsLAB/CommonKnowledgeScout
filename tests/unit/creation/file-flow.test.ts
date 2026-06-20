/**
 * Tests von flowComputesFileInSchemaTypeStep: erkennt Off-target-Datei-Flows
 * anhand des `selectSchemaType`-Schritts (statt hartkodierter Template-IDs).
 */

import { describe, expect, it } from 'vitest'
import { flowComputesFileInSchemaTypeStep } from '@/lib/creation/file-flow'

describe('flowComputesFileInSchemaTypeStep', () => {
  it('true, wenn der Flow einen selectSchemaType-Schritt hat (standard-capture)', () => {
    const steps = [
      { preset: 'welcome' },
      { preset: 'collectSource' },
      { preset: 'selectSchemaType' },
      { preset: 'editDraft' },
      { preset: 'publish' },
    ]
    expect(flowComputesFileInSchemaTypeStep(steps)).toBe(true)
  })

  it('true auch für file-transcript-de (gleicher Schritt-Aufbau)', () => {
    const steps = [
      { preset: 'welcome' },
      { preset: 'collectSource' },
      { preset: 'selectSchemaType' },
      { preset: 'editDraft' },
      { preset: 'publish' },
    ]
    expect(flowComputesFileInSchemaTypeStep(steps)).toBe(true)
  })

  it('false für Text-Flows ohne selectSchemaType (process-text-Pfad)', () => {
    const steps = [
      { preset: 'welcome' },
      { preset: 'collectSource' },
      { preset: 'editDraft' },
      { preset: 'publish' },
    ]
    expect(flowComputesFileInSchemaTypeStep(steps)).toBe(false)
  })

  it('false bei undefined/null/leer (kein silent fallback auf true)', () => {
    expect(flowComputesFileInSchemaTypeStep(undefined)).toBe(false)
    expect(flowComputesFileInSchemaTypeStep(null)).toBe(false)
    expect(flowComputesFileInSchemaTypeStep([])).toBe(false)
  })
})
