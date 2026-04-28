/**
 * Tests fuer den Helper `appendCustomHintToTemplate`.
 *
 * Verifiziert:
 *   1. Anhaengen mit nicht-leerem Hint funktioniert.
 *   2. Trimming wird angewendet (whitespace-only zaehlt als leer).
 *   3. null/undefined/leerer String aendern den Template-Content nicht.
 *   4. Praeambel-Marker "VERBINDLICHER KORREKTURHINWEIS" ist enthalten —
 *      DAS ist der Marker, auf den z.B. das gaderform-bett-steckbrief-de-
 *      Template im Systemprompt verweist. Wenn der Marker geaendert wird,
 *      bricht das Template-Verhalten — daher als Test geschuetzt.
 */
import { describe, it, expect } from 'vitest'
import { appendCustomHintToTemplate } from '@/lib/external-jobs/append-custom-hint'

describe('appendCustomHintToTemplate', () => {
  const TEMPLATE = '--- frontmatter ---\n# Body\n--- systemprompt\nRolle: ...'

  it('haengt einen nicht-leeren Hint korrekt ans Ende an', () => {
    const result = appendCustomHintToTemplate(TEMPLATE, 'Modell: GARDENA')

    expect(result.appended).toBe(true)
    expect(result.hintLength).toBe('Modell: GARDENA'.length)
    expect(result.content.startsWith(TEMPLATE)).toBe(true)
    expect(result.content.endsWith('Modell: GARDENA')).toBe(true)
  })

  it('enthaelt den Praeambel-Marker "VERBINDLICHER KORREKTURHINWEIS"', () => {
    // Diese Konstante ist Teil des Template-Vertrags (siehe gaderform-bett-
    // steckbrief-de.md Z. 70-79). Aenderung hier bricht Template-Verhalten.
    const result = appendCustomHintToTemplate(TEMPLATE, 'Modell: GARDENA')

    expect(result.content).toContain('VERBINDLICHER KORREKTURHINWEIS')
  })

  it('trimmt umgebenden Whitespace im Hint', () => {
    const result = appendCustomHintToTemplate(TEMPLATE, '   Modell: GARDENA   \n')

    expect(result.appended).toBe(true)
    expect(result.hintLength).toBe('Modell: GARDENA'.length)
    expect(result.content.endsWith('Modell: GARDENA')).toBe(true)
  })

  it('aendert Template-Content nicht bei leerem String', () => {
    const result = appendCustomHintToTemplate(TEMPLATE, '')

    expect(result.appended).toBe(false)
    expect(result.hintLength).toBe(0)
    expect(result.content).toBe(TEMPLATE)
  })

  it('aendert Template-Content nicht bei whitespace-only String', () => {
    const result = appendCustomHintToTemplate(TEMPLATE, '   \n\t  ')

    expect(result.appended).toBe(false)
    expect(result.content).toBe(TEMPLATE)
  })

  it('aendert Template-Content nicht bei null', () => {
    const result = appendCustomHintToTemplate(TEMPLATE, null)

    expect(result.appended).toBe(false)
    expect(result.content).toBe(TEMPLATE)
  })

  it('aendert Template-Content nicht bei undefined', () => {
    const result = appendCustomHintToTemplate(TEMPLATE, undefined)

    expect(result.appended).toBe(false)
    expect(result.content).toBe(TEMPLATE)
  })
})
