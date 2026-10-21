/**
 * Welle C3 — Video-Anmeldung geht als Feld `cookies` im Body der Medien-Aufrufe mit,
 * nur wenn die Person eine hinterlegt hat; bestehende Felder bleiben.
 */
import { describe, expect, it } from 'vitest'
import { medienAnfrageBody } from '@/lib/web-source/media-resolve'

describe('medienAnfrageBody', () => {
  it('ohne Anmeldung nur url (und Zusatzfelder) — kein leeres cookies-Feld', () => {
    expect(JSON.parse(medienAnfrageBody('https://v/x', null))).toEqual({ url: 'https://v/x' })
    expect(JSON.parse(medienAnfrageBody('https://v/x', '   '))).toEqual({ url: 'https://v/x' })
    expect(JSON.parse(medienAnfrageBody('https://v/x', undefined, { nur_audio: true }))).toEqual({ url: 'https://v/x', nur_audio: true })
  })

  it('mit Anmeldung: cookies als Text im Body', () => {
    const body = JSON.parse(medienAnfrageBody('https://v/x', '.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tabc')) as { url: string; cookies: string }
    expect(body.url).toBe('https://v/x')
    expect(body.cookies).toContain('SID')
  })
})
