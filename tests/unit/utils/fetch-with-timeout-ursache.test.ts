/**
 * @fileoverview Unit-Tests: Netzfehler tragen ihre Ursache (Welle I3).
 *
 * Node meldet „fetch failed" und haengt ECONNREFUSED oder
 * UND_ERR_HEADERS_TIMEOUT an `cause`; ohne sie war der Job-Fehler nicht deutbar.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetworkError, fetchWithTimeout, meldungMitUrsache } from '@/lib/utils/fetch-with-timeout'

afterEach(() => vi.unstubAllGlobals())

describe('meldungMitUrsache', () => {
  it('haengt Code und Meldung der Ursache an', () => {
    const e = new Error('fetch failed', { cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:3000' } })
    expect(meldungMitUrsache(e)).toBe('fetch failed (ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:3000)')
  })

  it('bleibt ohne Ursache bei der Meldung', () => {
    expect(meldungMitUrsache(new Error('kaputt'))).toBe('kaputt')
  })
})

describe('fetchWithTimeout', () => {
  it('wirft NetworkError mit Ursache im Text und am Objekt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed', { cause: { code: 'UND_ERR_HEADERS_TIMEOUT' } })))
    const fehler = await fetchWithTimeout('http://localhost/x').catch((e: unknown) => e)
    expect(fehler).toBeInstanceOf(NetworkError)
    expect((fehler as Error).message).toBe('fetch failed (UND_ERR_HEADERS_TIMEOUT)')
    expect(((fehler as Error).cause as { code: string }).code).toBe('UND_ERR_HEADERS_TIMEOUT')
  })
})
