/**
 * @fileoverview Tests fuer parseCompositeSourceEntry und appendTemplateSuffix.
 *
 * Diese kleinen Helper steuern, ob ein _source_files-Eintrag als Transcript-Lookup
 * (ohne Suffix) oder als Transformations-Lookup (mit Schraegstrich-Suffix) behandelt wird.
 */

import { describe, expect, it } from 'vitest'
import {
  parseCompositeSourceEntry,
  appendTemplateSuffix,
} from '@/lib/creation/composite-source-entry'

describe('parseCompositeSourceEntry', () => {
  it('Eintrag ohne Schraegstrich → nur name, kein templateName', () => {
    const r = parseCompositeSourceEntry('seite1.pdf')
    expect(r).toEqual({ name: 'seite1.pdf', raw: 'seite1.pdf' })
    expect(r.templateName).toBeUndefined()
  })

  it('Eintrag mit Schraegstrich → name + templateName', () => {
    const r = parseCompositeSourceEntry('seite1.pdf/gaderform-bett-steckbrief')
    expect(r.name).toBe('seite1.pdf')
    expect(r.templateName).toBe('gaderform-bett-steckbrief')
    expect(r.raw).toBe('seite1.pdf/gaderform-bett-steckbrief')
  })

  it('Schraegstriche im Templatenamen bleiben erhalten (split nur am ERSTEN /)', () => {
    const r = parseCompositeSourceEntry('seite1.pdf/group/template')
    expect(r.name).toBe('seite1.pdf')
    expect(r.templateName).toBe('group/template')
  })

  it('Leerer Eintrag → nur raw zurueck', () => {
    const r = parseCompositeSourceEntry('')
    expect(r.name).toBe('')
    expect(r.templateName).toBeUndefined()
  })

  it('Eintrag beginnt mit / → Eintrag wird NICHT als Transformation behandelt', () => {
    const r = parseCompositeSourceEntry('/template')
    expect(r.name).toBe('/template')
    expect(r.templateName).toBeUndefined()
  })

  it('Eintrag endet mit / → Eintrag wird NICHT als Transformation behandelt', () => {
    const r = parseCompositeSourceEntry('seite1.pdf/')
    expect(r.name).toBe('seite1.pdf/')
    expect(r.templateName).toBeUndefined()
  })
})

describe('appendTemplateSuffix', () => {
  it('Ohne templateName → Originalname zurueck', () => {
    expect(appendTemplateSuffix('seite1.pdf', undefined)).toBe('seite1.pdf')
    expect(appendTemplateSuffix('seite1.pdf', null)).toBe('seite1.pdf')
    expect(appendTemplateSuffix('seite1.pdf', '')).toBe('seite1.pdf')
  })

  it('Mit templateName → Suffix mit Schraegstrich', () => {
    expect(appendTemplateSuffix('seite1.pdf', 'tmpl')).toBe('seite1.pdf/tmpl')
  })
})
