import { describe, it, expect } from 'vitest'
import {
  isRecord,
  isStringArray,
  isSupportedSource,
  isFlowStep,
  isTemplateCreationConfig,
} from '@/lib/creation/creation-flow-validation'

describe('isRecord / isStringArray', () => {
  it('isRecord nur fuer Plain-Objekte', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
  })
  it('isStringArray nur fuer String-Arrays', () => {
    expect(isStringArray(['a', 'b'])).toBe(true)
    expect(isStringArray([])).toBe(true)
    expect(isStringArray(['a', 1])).toBe(false)
    expect(isStringArray('a')).toBe(false)
  })
})

describe('isSupportedSource', () => {
  it('akzeptiert gueltige Quellen, lehnt fehlerhafte ab', () => {
    expect(isSupportedSource({ id: 'file', type: 'file', label: 'Datei' })).toBe(true)
    expect(isSupportedSource({ id: 'file', type: 'file', label: 'Datei', helpText: 'x' })).toBe(true)
    expect(isSupportedSource({ id: 'file', type: 'file' })).toBe(false) // label fehlt
    expect(isSupportedSource({ id: 'file', type: 'file', label: 1 })).toBe(false)
  })
})

describe('isFlowStep', () => {
  it('verlangt id + preset, optionale Felder typgeprueft', () => {
    expect(isFlowStep({ id: 'w', preset: 'welcome' })).toBe(true)
    expect(isFlowStep({ id: 'w', preset: 'editDraft', fields: ['title'] })).toBe(true)
    expect(isFlowStep({ id: 'w' })).toBe(false) // preset fehlt
    expect(isFlowStep({ id: 'w', preset: 'editDraft', fields: [1] })).toBe(false)
  })
})

describe('isTemplateCreationConfig', () => {
  const valid = {
    supportedSources: [{ id: 'file', type: 'file', label: 'Datei' }],
    flow: { steps: [{ id: 'w', preset: 'welcome' }] },
  }

  it('akzeptiert eine minimale gueltige Config', () => {
    expect(isTemplateCreationConfig(valid)).toBe(true)
  })

  it('akzeptiert optionale Bloecke (ui/output/welcome/preview/followWizards)', () => {
    expect(
      isTemplateCreationConfig({
        ...valid,
        ui: { displayName: 'X' },
        output: { fileName: { extension: 'md' } },
        welcome: { markdown: '# Hi' },
        preview: { detailViewType: 'book' },
        followWizards: { testimonialTemplateId: 't' },
      }),
    ).toBe(true)
  })

  it('lehnt fehlende/fehlerhafte Pflichtteile ab', () => {
    expect(isTemplateCreationConfig(null)).toBe(false)
    expect(isTemplateCreationConfig({ flow: { steps: [] } })).toBe(false) // supportedSources fehlt
    expect(isTemplateCreationConfig({ supportedSources: [], flow: {} })).toBe(false) // steps fehlt
    expect(isTemplateCreationConfig({ ...valid, followWizards: { testimonialTemplateId: 1 } })).toBe(false)
  })
})
