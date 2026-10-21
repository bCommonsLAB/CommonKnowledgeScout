/**
 * Welle C2 — Cookie-Datei am Konto: Format pruefen, beschreiben (nie Inhalt), Status.
 */
import { describe, expect, it } from 'vitest'
import { MAX_COOKIES_BYTES, beschreibeCookiesDatei, statusAusBeschreibung } from '@/lib/video-login/cookies-datei'

const ABLAUF_2027 = 1800000000 // 2027-01-15
const DATEI = [
  '# Netscape HTTP Cookie File',
  '# https://curl.haxx.se/rfc/cookie_spec.html',
  '',
  `.youtube.com\tTRUE\t/\tTRUE\t${ABLAUF_2027}\tSID\tgeheim1`,
  `.youtube.com\tTRUE\t/\tTRUE\t${ABLAUF_2027 + 1000}\tHSID\tgeheim2`,
  '.google.com\tTRUE\t/\tTRUE\t0\tSESSION\tgeheim3',
  `example.org\tFALSE\t/\tFALSE\t${ABLAUF_2027 - 5000}\tx\ty`,
].join('\r\n')

describe('beschreibeCookiesDatei', () => {
  it('zaehlt Zeilen, nennt Domains ohne Punkt, erkennt YouTube und den fruehesten Ablauf eines YouTube-/Google-Cookies', () => {
    const b = beschreibeCookiesDatei(DATEI)
    expect(b.zeilen).toBe(4)
    expect(b.domains).toEqual(['example.org', 'google.com', 'youtube.com'])
    expect(b.hatYoutube).toBe(true)
    expect(b.laeuftAbAm).toBe(new Date(ABLAUF_2027 * 1000).toISOString())
    expect(JSON.stringify(b)).not.toContain('geheim')
  })

  it('nur Sitzungs-Cookies: kein Ablauf; ohne YouTube-Domain: hatYoutube false', () => {
    const b = beschreibeCookiesDatei('example.org\tFALSE\t/\tFALSE\t0\tx\ty\n')
    expect(b).toEqual({ zeilen: 1, domains: ['example.org'], hatYoutube: false, laeuftAbAm: null })
  })

  it('weist fremdes Format, leere Datei und Uebergroesse laut ab', () => {
    expect(() => beschreibeCookiesDatei('{"cookies": []}')).toThrow(/Netscape-Format/)
    expect(() => beschreibeCookiesDatei('# nur Kommentar\n\n')).toThrow(/keine Cookie-Zeilen/)
    expect(() => beschreibeCookiesDatei('x'.repeat(MAX_COOKIES_BYTES + 1))).toThrow(/zu gross/)
  })
})

describe('statusAusBeschreibung', () => {
  it('ohne Dokument: nicht hinterlegt; mit Dokument: abgelaufen nach Datum', () => {
    expect(statusAusBeschreibung(null, null)).toMatchObject({ hinterlegt: false, abgelaufen: false, domains: [] })
    const b = beschreibeCookiesDatei(DATEI)
    expect(statusAusBeschreibung(b, '2026-10-21T10:00:00.000Z', new Date('2026-10-21T12:00:00Z'))).toMatchObject({ hinterlegt: true, abgelaufen: false, aktualisiertAm: '2026-10-21T10:00:00.000Z' })
    expect(statusAusBeschreibung(b, '2026-10-21T10:00:00.000Z', new Date('2028-01-01T00:00:00Z')).abgelaufen).toBe(true)
  })
})
