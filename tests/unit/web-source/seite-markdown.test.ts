/**
 * @fileoverview Seite woertlich als Markdown: nichts gefiltert, jeder Link an
 * seinem Platz. Fixture ist erfunden (Rednerliste einer Versammlung).
 */

import { describe, it, expect } from 'vitest'
import { seiteAlsMarkdown } from '@/lib/web-source/seite-markdown'
import { linkArt } from '@/lib/web-source/seite-links'

const BASIS = 'https://konferenz.example/node/42'

const SEITE = `<!doctype html><html lang="en"><head><title>Segment</title><style>p{color:red}</style>
<script>var a = "<p>nicht lesen</p>";</script></head><body>
<header><nav><ul><li><a href="/home">Home</a></li></ul></nav></header>
<main>
  <h1>High-Level Segment</h1>
  <div class="intro">Statements are listed in <em>speaking</em> order.</div>
  <h2>Tuesday, 17 November, 10:00&ndash;13:00</h2>
  <ol>
    <li>Fiji &mdash; H.E. Ms. Ana Beispiel, Minister <a href="/sites/default/files/FIJI_statement.pdf">Statement</a></li>
    <li>Spain <a href="https://files.example/SPAIN_SP.pdf?download=1">Declaración</a>
      <ul><li>Annex <a href="annex.docx">Annex A</a></li></ul>
    </li>
    <li>Chad
  </ol>
  <h2>Documents</h2>
  <table>
    <thead><tr><th>Symbol</th><th>Title</th></tr></thead>
    <tbody><tr><td>FCCC/1</td><td><a href="/documents/1">Agenda | provisional</a></td></tr>
    <tr><td>FCCC/2<td>Report</tr></tbody>
  </table>
  <dl><div><dt>Document Type</dt><dd>Statements</dd></div><dt>Language</dt><dd>Spanish</dd></dl>
  <div class="field"><div class="field__label">Publication date</div><div class="field__item">17 Nov 2026</div></div>
  <p>Kontakt: <a href="mailto:info@konferenz.example">info</a>, <a href="#top">nach oben</a>, <a href="javascript:void(0)">Menü</a></p>
  <a href="/webcast/stream.m3u8"><div><h3>Webcast</h3><p>Watch live</p></div></a>
</main>
<footer><p>Impressum <a href="/imprint">hier</a></p></footer></body></html>`

describe('seiteAlsMarkdown', () => {
  const { markdown, links, bereich } = seiteAlsMarkdown(SEITE, BASIS)

  it('liest den Inhaltsbereich, nicht Kopf und Fuss', () => {
    expect(bereich).toBe('main')
    expect(markdown).not.toContain('Home')
    expect(markdown).not.toContain('Impressum')
    expect(markdown).not.toContain('nicht lesen')
    expect(markdown).not.toContain('color:red')
  })

  it('gibt Ueberschriften, Absaetze und Entities woertlich wieder', () => {
    expect(markdown).toContain('# High-Level Segment')
    expect(markdown).toContain('Statements are listed in speaking order.')
    expect(markdown).toContain('## Tuesday, 17 November, 10:00–13:00')
  })

  it('behaelt jede Listenzeile, auch kurze und nicht geschlossene, mit ihrem Link', () => {
    expect(markdown).toContain('1. Fiji — H.E. Ms. Ana Beispiel, Minister [Statement](https://konferenz.example/sites/default/files/FIJI_statement.pdf)')
    expect(markdown).toContain('2. Spain [Declaración](https://files.example/SPAIN_SP.pdf?download=1)\n  - Annex [Annex A](https://konferenz.example/node/annex.docx)\n3. Chad')
  })

  it('schreibt Tabellen als Markdown-Tabelle', () => {
    expect(markdown).toContain('| Symbol | Title |\n| --- | --- |\n| FCCC/1 | [Agenda \\| provisional](https://konferenz.example/documents/1) |\n| FCCC/2 | Report |')
  })

  it('schreibt Definitionslisten und Feld-Paare', () => {
    expect(markdown).toContain('- **Document Type:** Statements\n- **Language:** Spanish')
    expect(markdown).toContain('Publication date\n\n17 Nov 2026')
  })

  it('listet Links mit Art, Abschnitt und Kontext — Anker und Skripte nicht', () => {
    expect(links.map((l) => [l.text, l.art])).toEqual([
      ['Statement', 'pdf'], ['Declaración', 'pdf'], ['Annex A', 'dokument'], ['Agenda | provisional', 'seite'], ['info', 'mail'], ['Webcast Watch live', 'medium'],
    ])
    expect(links[0]).toMatchObject({ nr: 1, abschnitt: 'Tuesday, 17 November, 10:00–13:00', kontext: 'Fiji — H.E. Ms. Ana Beispiel, Minister Statement' })
    expect(links[1].kontext).toBe('Spain Declaración')
    expect(links[3]).toMatchObject({ abschnitt: 'Documents', kontext: 'FCCC/1 | Agenda \\| provisional |' })
    expect(markdown).toContain('nach oben')
    expect(markdown).not.toContain('#top')
  })

  it('nimmt mit ganzeSeite auch Kopf und Fuss', () => {
    const ganz = seiteAlsMarkdown(SEITE, BASIS, { ganzeSeite: true })
    expect(ganz.bereich).toBe('body')
    expect(ganz.markdown).toContain('[Home](https://konferenz.example/home)')
    expect(ganz.markdown).toContain('Impressum')
  })

  it('faellt ohne main bei mehreren article auf body zurueck und achtet base href', () => {
    const r = seiteAlsMarkdown('<html><head><base href="https://cdn.example/x/"></head><body><article><p>Eins <a href="a.pdf">A</a></p></article><article><p>Zwei</p></article></body></html>', BASIS)
    expect(r.bereich).toBe('body')
    expect(r.markdown).toBe('Eins [A](https://cdn.example/x/a.pdf)\n\nZwei')
  })
})

describe('linkArt', () => {
  it('liest die Art nur aus der Endung', () => {
    expect(linkArt('https://a.example/x/Datei.PDF')).toBe('pdf')
    expect(linkArt('https://a.example/download?id=7')).toBe('seite')
    expect(linkArt('https://a.example/a.m3u8?token=1')).toBe('medium')
    expect(linkArt('https://a.example/bild.webp')).toBe('bild')
  })
})
