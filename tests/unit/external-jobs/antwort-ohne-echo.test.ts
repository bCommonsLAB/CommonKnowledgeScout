/**
 * @fileoverview Unit-Tests: Fehlertext ungekuerzt, Vorschau ohne request-Echo (Welle I3).
 */

import { describe, expect, it } from 'vitest'
import { antwortOhneEcho, fehlerTextAusAntwort } from '@/lib/external-jobs/template-run'

describe('fehlerTextAusAntwort — Welle I3', () => {
  it('kuerzt die Meldung des Secretary nicht mehr auf 600 Zeichen', () => {
    const lang = 'm'.repeat(2000)
    const text = fehlerTextAusAntwort(400, 'Bad Request', { error: { code: 'TEMPLATE_TRANSFORMATION_ERROR', message: lang } })
    expect(text).toBe(`[TEMPLATE_TRANSFORMATION_ERROR] ${lang}`)
  })
})

describe('antwortOhneEcho', () => {
  it('entfernt nur das request-Echo', () => {
    expect(antwortOhneEcho({ status: 'success', request: { huge: 'x' }, data: { error: { message: 'kaputt' } } }))
      .toEqual({ status: 'success', data: { error: { message: 'kaputt' } } })
  })

  it('laesst Nicht-Objekte unveraendert', () => {
    expect(antwortOhneEcho('text')).toBe('text')
    expect(antwortOhneEcho(null)).toBeNull()
    expect(antwortOhneEcho([1])).toEqual([1])
  })
})
