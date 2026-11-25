/**
 * @fileoverview Tests: Erkennung unveraendert publizierter Markdown-Quellen.
 *
 * Nur sie duerfen aus dem Hinweis „Quelldatei wurde geaendert" mit einem Klick
 * neu uebernommen werden — bei allen anderen schreibt ein Sprachmodell neu.
 */

import { describe, it, expect } from 'vitest'
import { isUnchangedPublication, isUnchangedTemplate } from '@/lib/shadow-twin/unchanged-templates'
import { VORLAGE_MARKDOWN, VORLAGE_WEBSITE, vorlageFuer } from '@/lib/mcp/website-publizieren'

describe('isUnchangedTemplate', () => {
  it('erkennt genau die Vorlagennamen, die dokument_publizieren vergibt', () => {
    expect(isUnchangedTemplate(vorlageFuer('website'))).toBe(true)
    expect(isUnchangedTemplate(vorlageFuer(null))).toBe(true)
    expect(isUnchangedTemplate(VORLAGE_WEBSITE)).toBe(true)
    expect(isUnchangedTemplate(VORLAGE_MARKDOWN)).toBe(true)
  })

  it('lehnt Sprachmodell-Vorlagen und fehlende Namen ab', () => {
    expect(isUnchangedTemplate('commoning-musterkarte-de')).toBe(false)
    expect(isUnchangedTemplate(undefined)).toBe(false)
    expect(isUnchangedTemplate('')).toBe(false)
  })
})

describe('isUnchangedPublication', () => {
  it('true, wenn jede Transformation unveraendert publiziert wurde', () => {
    expect(isUnchangedPublication([{ kind: 'transformation', templateName: 'markdown-page' }])).toBe(true)
  })

  it('false ohne Transformation — dann gibt es nichts zu uebernehmen', () => {
    expect(isUnchangedPublication([])).toBe(false)
    expect(isUnchangedPublication([{ kind: 'transcript' }])).toBe(false)
  })

  it('false, sobald eine Sprachmodell-Transformation daneben liegt', () => {
    expect(isUnchangedPublication([
      { kind: 'transformation', templateName: 'markdown-page' },
      { kind: 'transformation', templateName: 'commoning-musterkarte-de' },
    ])).toBe(false)
  })
})
