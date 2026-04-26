/**
 * Unit-Tests fuer pure Helper aus `src/lib/storage/onedrive/errors.ts`.
 *
 * Diese Helper wurden in Welle 1 / Schritt 4 aus `onedrive-provider.ts`
 * extrahiert. Tests sichern das beobachtete Verhalten ab.
 */

import { describe, expect, it } from 'vitest'
import { extractGraphEndpoint, parseRetryAfter } from '@/lib/storage/onedrive/errors'

describe('extractGraphEndpoint', () => {
  it('extrahiert den Pfad nach /v1.0/', () => {
    expect(
      extractGraphEndpoint('https://graph.microsoft.com/v1.0/me/drive/items/abc/children'),
    ).toBe('me/drive/items/abc/children')
  })

  it('extrahiert den Pfad nach /beta/', () => {
    expect(
      extractGraphEndpoint('https://graph.microsoft.com/beta/me/drive/root/children'),
    ).toBe('me/drive/root/children')
  })

  it('liefert pathname zurueck, wenn weder /v1.0/ noch /beta/ matched', () => {
    expect(extractGraphEndpoint('https://example.com/some/path')).toBe('/some/path')
  })

  it('liefert ersten 100-Zeichen-Prefix bei ungueltiger URL (kein Throw)', () => {
    const broken = 'not-a-url'
    expect(extractGraphEndpoint(broken)).toBe(broken)
  })

  it('schneidet Fallback bei sehr langer ungueltiger URL auf 100 Zeichen', () => {
    const longBroken = 'x'.repeat(150)
    expect(extractGraphEndpoint(longBroken)).toBe('x'.repeat(100))
  })
})

describe('parseRetryAfter', () => {
  it('liefert Sekunden als Zahl, wenn Header eine Zahl ist', () => {
    expect(parseRetryAfter('30')).toBe(30)
    expect(parseRetryAfter('120')).toBe(120)
  })

  it('parst HTTP-Date in Sekunden bis Retry', () => {
    const future = new Date(Date.now() + 60_000).toUTCString()
    const seconds = parseRetryAfter(future)
    expect(seconds).not.toBeNull()
    expect(seconds!).toBeGreaterThanOrEqual(58)
    expect(seconds!).toBeLessThanOrEqual(61)
  })

  it('liefert mindestens 1 Sekunde fuer ein vergangenes Datum', () => {
    const past = new Date(Date.now() - 60_000).toUTCString()
    expect(parseRetryAfter(past)).toBe(1)
  })

  it('liefert null fuer null/undefined/leeren Header', () => {
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter(undefined)).toBeNull()
    expect(parseRetryAfter('')).toBeNull()
  })

  it('liefert null fuer unparsbaren String', () => {
    expect(parseRetryAfter('not a date')).toBeNull()
  })
})
