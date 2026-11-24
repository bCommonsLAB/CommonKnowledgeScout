/**
 * @fileoverview Leseergebnis einer Seite: Metadaten neben dem Markdown, und der
 * ehrliche Hinweis, wenn das HTML keinen Text traegt.
 */

import { describe, it, expect } from 'vitest'
import { HINWEIS_OHNE_TEXT, leseSeiteAusHtml } from '@/lib/web-source/seite-lesen'
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

  it('sagt, wenn die Seite erst im Browser entsteht, und nennt die Umleitung', () => {
    const r = leseSeiteAusHtml('<html><body><div id="app"></div><script src="/app.js"></script></body></html>', 'https://a.example/x', 'https://b.example/y')
    expect(r.markdown).toBe('')
    expect(r.hinweise).toEqual([HINWEIS_OHNE_TEXT, 'Umgeleitet nach https://b.example/y'])
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
