/**
 * Characterization Tests fuer src/lib/templates/placeholders.ts.
 * Welle 2.2 Schritt 3.
 */

import { describe, expect, it } from 'vitest'
import {
  extractPlaceholders,
  parseHeadings,
  assignHeadingsToPlaceholders,
} from '@/lib/templates/placeholders'

describe('extractPlaceholders', () => {
  it('liefert leeres Array bei leerem Text', () => {
    expect(extractPlaceholders('')).toEqual([])
  })

  it('liefert leeres Array bei nicht-string Input', () => {
    expect(extractPlaceholders(null as unknown as string)).toEqual([])
    expect(extractPlaceholders(undefined as unknown as string)).toEqual([])
  })

  it('extrahiert einen Placeholder mit Frage', () => {
    const r = extractPlaceholders('Foo {{name|Wer ist das?}} bar')
    expect(r).toHaveLength(1)
    expect(r[0].key).toBe('name')
    expect(r[0].question).toBe('Wer ist das?')
    expect(r[0].index).toBe(4)
  })

  it('ignoriert Placeholder ohne key (leerer Schluessel)', () => {
    const r = extractPlaceholders('Foo {{|frage}} bar')
    expect(r).toEqual([])
  })

  it('extrahiert mehrere Placeholder in der richtigen Reihenfolge', () => {
    const r = extractPlaceholders('A {{a|q1}} B {{b|q2}}')
    expect(r.map((x) => x.key)).toEqual(['a', 'b'])
  })

  it('trimmt key und question', () => {
    const r = extractPlaceholders('{{ key1 |  Was ist das?  }}')
    expect(r[0].key).toBe('key1')
    expect(r[0].question).toBe('Was ist das?')
  })
})

describe('parseHeadings', () => {
  it('liefert leeres Array bei Text ohne Headings', () => {
    expect(parseHeadings('Just text\nMore text')).toEqual([])
  })

  it('parsed verschiedene Heading-Level', () => {
    const r = parseHeadings('# H1\n## H2\n### H3')
    expect(r).toHaveLength(3)
    expect(r[0].level).toBe(1)
    expect(r[1].level).toBe(2)
    expect(r[2].level).toBe(3)
  })

  it('clamped Heading-Level auf max 6', () => {
    const r = parseHeadings('####### TooDeep')
    // Regex matcht nur # bis 6 — die anderen werden als Title-Praefix
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe(6)
  })

  it('berechnet start-Offset', () => {
    const text = 'Line 1\n# Heading'
    const r = parseHeadings(text)
    // 'Line 1\n' = 7 Zeichen
    expect(r[0].start).toBe(7)
  })
})

describe('assignHeadingsToPlaceholders', () => {
  it('liefert leeres Array bei keinem Placeholder', () => {
    expect(assignHeadingsToPlaceholders('# H\nText')).toEqual([])
  })

  it('weist headingPath dem letzten Heading zu', () => {
    const text = '# Outer\n{{a|q}}'
    const r = assignHeadingsToPlaceholders(text)
    expect(r).toHaveLength(1)
    expect(r[0].headingPath).toEqual(['Outer'])
  })

  it('baut hierarchischen Pfad aus aufsteigenden Levels', () => {
    const text = '# H1\n## H2\n### H3\n{{a|q}}'
    const r = assignHeadingsToPlaceholders(text)
    expect(r[0].headingPath).toEqual(['H1', 'H2', 'H3'])
  })

  it('uebernimmt nur Headings VOR dem Placeholder', () => {
    const text = '{{a|q}}\n# Nachher'
    const r = assignHeadingsToPlaceholders(text)
    expect(r[0].headingPath).toEqual([])
  })
})
