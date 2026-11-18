/**
 * Welle N2 — Zielaufloesung der Kacheln: bekannte Ziele, explizite Fehler.
 * Was der Klick daraus macht, prueft seit WE2 `app-navigation.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { loeseKartenziel } from '@ks/module-website'

describe('loeseKartenziel', () => {
  it('loest die vier Zielarten auf', () => {
    expect(loeseKartenziel('?view=gallery')).toEqual({ art: 'galerie' })
    expect(loeseKartenziel('?mode=story')).toEqual({ art: 'story' })
    expect(loeseKartenziel('?site=wie-funktioniert')).toEqual({ art: 'seite', slug: 'wie-funktioniert' })
    expect(loeseKartenziel('https://example.org/a?b=1')).toEqual({ art: 'extern', url: 'https://example.org/a?b=1' })
    expect(loeseKartenziel('  http://example.org  ')).toEqual({ art: 'extern', url: 'http://example.org' })
  })

  it('dekodiert den Seiten-Slug', () => {
    expect(loeseKartenziel('?site=ueber%20uns')).toEqual({ art: 'seite', slug: 'ueber uns' })
  })

  it('wirft bei unbekanntem Ziel, nennt die erlaubten', () => {
    expect(() => loeseKartenziel('')).toThrow(/unbekannt \(erlaubt: \?view=gallery/)
    expect(() => loeseKartenziel('/explore/x')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('javascript:alert(1)')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('ftp://example.org')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('?view=site')).toThrow(/view="site"/)
    expect(() => loeseKartenziel('?mode=chat')).toThrow(/mode="chat"/)
    expect(() => loeseKartenziel('?site=')).toThrow(/ohne Seite/)
    expect(() => loeseKartenziel('?foo=bar')).toThrow(/unbekannt/)
    expect(() => loeseKartenziel('?view=gallery&doc=x')).toThrow(/weiteren Parametern/)
  })
})
