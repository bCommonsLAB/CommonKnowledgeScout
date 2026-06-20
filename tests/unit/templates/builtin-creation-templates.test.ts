import { describe, expect, it } from 'vitest'
import {
  getBuiltinCreationTemplate,
  isBuiltinCreationTemplateName,
} from '@/lib/templates/builtin-creation-templates'

describe('builtin-creation-templates', () => {
  it('liefert audio-transcript-de mit creation-Flow (Diktat: Textquelle)', () => {
    const t = getBuiltinCreationTemplate('audio-transcript-de', 'lib-x', 'u@test')
    expect(t).not.toBeNull()
    expect(t?.name).toBe('audio-transcript-de')
    expect(t?.creation?.flow.steps.map((s) => s.preset)).toEqual([
      'welcome',
      'collectSource',
      'editDraft',
      'publish',
    ])
    expect(t?.creation?.output?.wizardOnlyMetadataKeys).toContain('filename')
    expect(t?.creation?.supportedSources?.[0]?.type).toBe('text')
    expect(t?.creation?.ui?.displayName).toBe('Diktat erfassen')
    expect(t?.creation?.welcome?.markdown).toContain('Diktat')
  })

  it('isBuiltinCreationTemplateName', () => {
    expect(isBuiltinCreationTemplateName('audio-transcript-de')).toBe(true)
    expect(isBuiltinCreationTemplateName('unknown')).toBe(false)
  })

  it('W-D: liefert den generischen Standard-Flow aus dem Code (kind:wizard)', () => {
    const t = getBuiltinCreationTemplate('standard-capture', 'lib-x', 'u@test')
    expect(t).not.toBeNull()
    expect(t?.kind).toBe('wizard')
    expect(t?.creation?.flow.steps.map((s) => s.preset)).toEqual([
      'welcome',
      'collectSource',
      'selectSchemaType',
      'editDraft',
      'publish',
    ])
  })
})
