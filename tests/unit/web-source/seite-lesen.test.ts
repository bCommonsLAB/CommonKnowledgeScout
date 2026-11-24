/**
 * @fileoverview Leseergebnis einer Seite: Metadaten neben dem Markdown, und der
 * ehrliche Hinweis, wenn das HTML keinen Text traegt.
 */

import { describe, it, expect } from 'vitest'
import { leseSeite, leseSeiteAusHtml } from '@/lib/web-source/seite-lesen'
import { deuteLeereAntwort } from '@/lib/web-source/leere-antwort'
import { zeichensatzVon } from '@/lib/web-source/seite-laden'

describe('leseSeiteAusHtml', () => {
  it('liefert Metadaten, Markdown und Links aus einem Abruf', () => {
    const html = '<html lang="es"><head><meta property="og:title" content="Declaración"><meta property="article:published_time" content="2026-11-17T10:00:00Z"></head>' +
      '<body><main><h1>Declaración</h1><ul><li><a href="/files/a.pdf">PDF</a></li></ul></main></body></html>'
    const r = leseSeiteAusHtml(html, 'https://a.example/documents/7', 'https://a.example/documents/7')
    expect(r.meta).toMatchObject({ title: 'Declaración', datePublished: '2026-11-17', language: 'es' })
    expect(r.markdown).toBe('# Declaración\n\n- [PDF](https://a.example/files/a.pdf)')
    expect(r.links).toHaveLength(1)
    expect(r.hinweise).toEqual([])
  })

  it('nennt bei leerem Markdown die Einordnung und die Umleitung', () => {
    const r = leseSeiteAusHtml('<html><body><div id="app"></div><script src="/app.js"></script></body></html>', 'https://a.example/x', 'https://b.example/y')
    expect(r.markdown).toBe('')
    expect(r.leereAntwort?.art).toBe('javascript')
    expect(r.hinweise).toEqual([r.leereAntwort?.hinweis, 'Umgeleitet nach https://b.example/y'])
  })

  it('liest uebergebenes HTML, ohne zu laden, und sagt das', async () => {
    const r = await leseSeite('https://a.example/liste', { html: '<html><body><main><ul><li><a href="x.pdf">X</a></li></ul></main></body></html>' })
    expect(r.herkunft).toBe('uebergeben')
    expect(r.markdown).toBe('- [X](https://a.example/x.pdf)')
    expect(r.hinweise).toEqual(['Das HTML wurde uebergeben, nicht vom Server geladen — sein Stand ist der des Aufrufers'])
    await expect(leseSeite('file:///etc/passwd', { html: '<p>x</p>' })).rejects.toThrow('http/https')
  })
})

describe('deuteLeereAntwort', () => {
  it('erkennt eine Schutzseite und nennt nicht JavaScript', () => {
    const d = deuteLeereAntwort('<html><head><META NAME="robots" CONTENT="noindex,nofollow"><script src="/_Incapsula_Resource?SWJIYLWA=1"></script></head><body></body></html>')
    expect(d.art).toBe('schutzseite')
    expect(d.hinweis).not.toContain('JavaScript)')
    expect(d.rohAnfang).toContain('_Incapsula_Resource')
  })

  it('unterscheidet leer, Anwendungsgeruest und unbekannt', () => {
    expect(deuteLeereAntwort('  \n').art).toBe('leer')
    expect(deuteLeereAntwort('<html><body><div id="__next"></div></body></html>').art).toBe('javascript')
    const unbekannt = deuteLeereAntwort('<html><head><script src="/a.js"></script></head><body></body></html>')
    expect(unbekannt.art).toBe('unbekannt')
    expect(unbekannt.rohZeichen).toBeGreaterThan(0)
    expect(unbekannt.hinweis).toContain('nicht erkennbar')
  })
})

describe('zeichensatzVon', () => {
  it('nimmt Content-Type vor meta, sonst utf-8', () => {
    expect(zeichensatzVon('text/html; charset=ISO-8859-1', '<meta charset="utf-8">')).toBe('iso-8859-1')
    expect(zeichensatzVon('text/html', '<meta charset="windows-1252">')).toBe('windows-1252')
    expect(zeichensatzVon('text/html', '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-15">')).toBe('iso-8859-15')
    expect(zeichensatzVon('text/html', '<html>')).toBe('utf-8')
  })
})

describe('Seite ohne Bild', () => {
  it('nennt kein Bild, statt die Seitenadresse als Bild auszugeben', () => {
    const r = leseSeiteAusHtml('<html><head><title>T</title></head><body><main><p>Ein Absatz mit Text.</p></main></body></html>', 'https://a.example/d/1', 'https://a.example/d/1')
    expect(r.meta.imageUrl).toBe('')
  })
})
