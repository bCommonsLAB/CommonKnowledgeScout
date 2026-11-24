/**
 * @fileoverview Sammeldatei im Modus `struktur`: Seite ohne Fliesstext wird
 * woertlich uebernommen, verlinkte Dateien stehen als eigene Liste.
 */

import { describe, it, expect } from 'vitest'
import { baueArtikelSammeldatei, stufeUeberschriftenAb, verlinkteDateien } from '@/lib/web-source/artikel-sammeldatei'
import { leseSeiteAusHtml } from '@/lib/web-source/seite-lesen'

const ADRESSE = 'https://konferenz.example/documents/7'
const HTML = '<html lang="es"><head><meta property="og:title" content="Statement Spain"><meta property="og:site_name" content="Konferenz">' +
  '<meta property="article:published_time" content="2026-11-17"></head><body><main><h1>Statement Spain</h1>' +
  '<dl><dt>Document Type</dt><dd>Statements</dd><dt>Language</dt><dd>Spanish</dd></dl>' +
  '<h2>Versions</h2><ul><li><a href="/files/SPAIN_SP.pdf">Spanish</a></li><li><a href="/files/SPAIN_SP.pdf">Download</a></li><li><a href="/event/1">Event</a></li></ul>' +
  '</main></body></html>'

function basis() {
  const gelesen = leseSeiteAusHtml(HTML, ADRESSE, ADRESSE)
  // Die Absatz-Suche zaehlt auch blosse Zwischenueberschriften; hier geht es um die Seite ganz ohne Bloecke.
  return { seite: { ...gelesen.meta, bloecke: [] }, medienDatei: null, coverDatei: null, medienDauerSekunden: null, gelesen }
}

describe('baueArtikelSammeldatei, Modus struktur', () => {
  it('weist die Seite ohne Absaetze im Modus artikel ab', () => {
    const { gelesen: _g, ...input } = basis()
    expect(() => baueArtikelSammeldatei(input)).toThrow('Seite ohne Artikeltext')
  })

  it('uebernimmt die Seite woertlich, mit Metadaten im Frontmatter und der Dateiliste', () => {
    const { gelesen, ...input } = basis()
    const md = baueArtikelSammeldatei({ ...input, struktur: { markdown: gelesen.markdown, links: gelesen.links } })
    expect(md).toContain('title: "Statement Spain"')
    expect(md).toContain('date: "2026-11-17"')
    expect(md).toContain('language: "es"')
    expect(md).toContain(`source_url: "${ADRESSE}"`)
    expect(md).toContain('## Seite\n\n### Statement Spain\n\n- **Document Type:** Statements\n- **Language:** Spanish\n\n#### Versions')
    expect(md).toContain('## Verlinkte Dateien\n\n- pdf: [Spanish](https://konferenz.example/files/SPAIN_SP.pdf)\n')
    expect(md).not.toContain('## Artikel')
  })
})

describe('Helfer', () => {
  it('stuft Ueberschriften um zwei Ebenen ab, hoechstens bis sechs', () => {
    expect(stufeUeberschriftenAb('# A\n\nText # kein Kopf\n\n##### E')).toBe('### A\n\nText # kein Kopf\n\n###### E')
  })

  it('listet nur Dateien, je Adresse einmal, mit Kontext wenn er mehr sagt als der Linktext', () => {
    const { gelesen } = basis()
    expect(verlinkteDateien(gelesen.links)).toEqual(['- pdf: [Spanish](https://konferenz.example/files/SPAIN_SP.pdf)'])
    expect(verlinkteDateien([{ nr: 1, text: 'Statement', url: 'https://a.example/f.pdf', art: 'pdf', abschnitt: '', kontext: 'Fiji — Minister Statement' }]))
      .toEqual(['- pdf: [Statement](https://a.example/f.pdf) — Fiji — Minister Statement'])
  })
})
