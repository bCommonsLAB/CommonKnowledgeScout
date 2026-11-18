import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callTemplateTransform } = vi.hoisted(() => ({ callTemplateTransform: vi.fn() }))
vi.mock('@/lib/secretary/adapter', () => ({ callTemplateTransform }))

import {
  callTranslationTransform,
  translationTimeoutMs,
  TRANSLATION_TIMEOUT_MAX_MS,
  TRANSLATION_TIMEOUT_MIN_MS,
} from '@/lib/chat/common/translation-timeout'
import { TimeoutError } from '@/lib/utils/fetch-with-timeout'

describe('translationTimeoutMs', () => {
  it('gibt kurzen Texten die Grundzeit plus einen Schritt', () => {
    expect(translationTimeoutMs(0)).toBe(TRANSLATION_TIMEOUT_MIN_MS)
    expect(translationTimeoutMs(800)).toBe(67_000)
  })

  it('waechst mit der Textlaenge (SFSCON-Median 19.000 Zeichen)', () => {
    expect(translationTimeoutMs(19_175)).toBe(60_000 + 20 * 7_000)
    expect(translationTimeoutMs(10_000)).toBeLessThan(translationTimeoutMs(20_000))
  })

  it('bleibt unter der Worker-Wartezeit von 300 s', () => {
    expect(translationTimeoutMs(55_220)).toBe(TRANSLATION_TIMEOUT_MAX_MS)
    expect(TRANSLATION_TIMEOUT_MAX_MS).toBeLessThan(300_000)
  })

  it('wirft bei ungueltiger Laenge statt still zu raten', () => {
    expect(() => translationTimeoutMs(-1)).toThrow(/Ungueltige Textlaenge/)
    expect(() => translationTimeoutMs(Number.NaN)).toThrow(/Ungueltige Textlaenge/)
  })
})

describe('callTranslationTransform', () => {
  // Block statt Ausdruck: gibt beforeEach eine Funktion zurueck, ruft Vitest sie
  // nach dem Test als Aufraeumer auf — hier waere das der Mock selbst.
  beforeEach(() => {
    callTemplateTransform.mockReset()
  })

  it('reicht die laengenabhaengige Zeitgrenze an den Secretary-Aufruf durch', async () => {
    const res = new Response('{}')
    callTemplateTransform.mockResolvedValue(res)
    const text = 'x'.repeat(19_175)
    const out = await callTranslationTransform({ url: 'u', text, targetLanguage: 'it', templateContent: 't' })
    expect(out).toBe(res)
    expect(callTemplateTransform).toHaveBeenCalledWith(expect.objectContaining({ text, timeoutMs: 200_000 }))
  })

  it('nennt bei abgelaufener Zeit Grenze und Textmenge', async () => {
    callTemplateTransform.mockRejectedValue(new TimeoutError())
    const p = callTranslationTransform({ url: 'u', text: 'x'.repeat(5_000), targetLanguage: 'de', templateContent: 't' })
    await expect(p).rejects.toBeInstanceOf(TimeoutError)
    await expect(p).rejects.toThrow('Uebersetzung nach 95 s abgebrochen (5000 Zeichen')
  })

  it('laesst andere Fehler unveraendert durch', async () => {
    const err = new Error('Secretary 500')
    callTemplateTransform.mockRejectedValue(err)
    await expect(
      callTranslationTransform({ url: 'u', text: 'abc', targetLanguage: 'de', templateContent: 't' }),
    ).rejects.toBe(err)
  })
})
