import { describe, expect, it } from 'vitest'
import { extractTextBlocks, extractWebPage } from '@/lib/web-source/page-extract'
import { baueArtikelSammeldatei } from '@/lib/web-source/artikel-sammeldatei'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

const HTML = `<!doctype html><html lang="de"><head>
<title>Seitentitel | Site</title>
<meta property="og:title" content="Armut im Land &ndash; ein Befund"/>
<meta property="og:description" content="Kurz &amp; knapp."/>
<meta property="og:site_name" content="TestNews"/>
<meta property="og:image" content="/img/cover.jpg"/>
<meta name="author" content="ab/cd"/>
<script type="application/ld+json">[{"@context":"https://schema.org","@type":"AudioObject","name":"x",
"uploadDate":"2026-09-27T18:20:43+0000","contentUrl":"https://media.example/relink?x=1","author":{"@type":"Person","name":"Redaktion","url":"https://x/y"}}]</script>
</head><body>
<nav><p>Menu Home Archiv Radio Live</p></nav>
<article class="article">
<header><h1>Armut im Land – ein Befund</h1><p>Kurz &amp; knapp.</p></header>
<p>Erster Absatz mit <b>Fett</b> und &quot;Zitat&quot;.</p>
<p>Zweiter Absatz.</p>
<h3>„Das ist schon krass”</h3>
<p>Dritter Absatz.</p>
<p>Erster Absatz mit <b>Fett</b> und &quot;Zitat&quot;.</p>
<ul><li>Tag1</li><li>Armut</li></ul>
</article>
<footer><p>Impressum Datenschutz und so weiter und so fort</p></footer>
</body></html>`

describe('extractWebPage', () => {
  const seite = extractWebPage(HTML, 'https://www.example.org/a/b.html')

  it('liest Titel, Beschreibung, Site, Autor (Name vor URL), Datum, Bild (absolut), Sprache', () => {
    expect(seite.title).toBe('Armut im Land – ein Befund')
    expect(seite.description).toBe('Kurz & knapp.')
    expect(seite.siteName).toBe('TestNews')
    expect(seite.author).toBe('Redaktion')
    expect(seite.datePublished).toBe('2026-09-27')
    expect(seite.imageUrl).toBe('https://www.example.org/img/cover.jpg')
    expect(seite.language).toBe('de')
  })

  it('nimmt nur den article-Block samt Vorspann im header, dedupliziert Absaetze, laesst kurze Listenpunkte und nav/footer weg', () => {
    expect(seite.bloecke).toEqual(['Kurz & knapp.', 'Erster Absatz mit Fett und "Zitat".', 'Zweiter Absatz.', '### „Das ist schon krass”', 'Dritter Absatz.'])
  })

  it('findet das Medium aus JSON-LD', () => {
    expect(seite.media).toEqual([{ url: 'https://media.example/relink?x=1', art: 'audio', herkunft: 'json-ld' }])
  })

  it('extractTextBlocks: Zitate und lange Listenpunkte bleiben', () => {
    const bloecke = extractTextBlocks('<blockquote><p>Ein Zitat.</p></blockquote><ul><li>Ein Listenpunkt, der lang genug ist, um Text zu sein.</li></ul>')
    expect(bloecke).toEqual(['> Ein Zitat.', '- Ein Listenpunkt, der lang genug ist, um Text zu sein.'])
  })
})

describe('baueArtikelSammeldatei', () => {
  const seite = extractWebPage(HTML, 'https://www.example.org/a/b.html')

  it('baut flaches Frontmatter mit Quellen und Medien und den Artikel woertlich im Body', () => {
    const md = baueArtikelSammeldatei({ seite, medienDatei: '05 Test - Audio.mp3', coverDatei: '05 Test - Cover.jpg', medienDauerSekunden: 544 })
    const { meta, body } = parseFrontmatter(md)
    expect(meta['kind']).toBe('composite-transcript')
    expect(meta['_include_self']).toBe(true)
    expect(meta['_source_files']).toEqual(['05 Test - Audio.mp3'])
    expect(meta['_media_files']).toEqual(['05 Test - Audio.mp3', '05 Test - Cover.jpg'])
    expect(meta['title']).toBe('Armut im Land – ein Befund')
    expect(meta['date']).toBe('2026-09-27')
    expect(body).toContain('# Armut im Land – ein Befund')
    // Beschreibung ist schon der Vorspann im Artikel → keine kursive Doppelung
    expect(body).not.toContain('*Kurz & knapp.*')
    expect(body).toContain('## Artikel\n\nKurz & knapp.\n\nErster Absatz mit Fett und "Zitat".\n\nZweiter Absatz.')
    expect(body).toContain('[[05 Test - Audio.mp3]] (9:04 min)')
    expect(body).toContain('Cover: [[05 Test - Cover.jpg]]')
  })

  it('ohne Medium: leere Quellenliste, kein Medien-Abschnitt', () => {
    const md = baueArtikelSammeldatei({ seite, medienDatei: null, coverDatei: null, medienDauerSekunden: null })
    const { meta, body } = parseFrontmatter(md)
    expect(meta['_source_files']).toEqual([])
    expect(body).not.toContain('Eingebettetes Medium')
  })

  it('wirft bei Seite ohne Text', () => {
    expect(() => baueArtikelSammeldatei({ seite: { ...seite, bloecke: [] }, medienDatei: null, coverDatei: null, medienDauerSekunden: null })).toThrow(/ohne Artikeltext/)
  })
})

describe('extractWebPage — Datum aus @graph (Befund Rai-Videoseite 13.10.)', () => {
  it('nimmt das Datum des VideoObject, auch wenn die WebPage im @graph vorher steht', () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","name":"Seite"},
      {"@type":"VideoObject","name":"Video","uploadDate":"2026-09-25T16:26:29+0000","contentUrl":"https://media.example/v"}
    ]}</script></head><body><article><p>Ein Absatz Text.</p></article></body></html>`
    expect(extractWebPage(html, 'https://example.org/v.html').datePublished).toBe('2026-09-25')
  })

  it('faellt auf video:release_date und <time datetime> zurueck', () => {
    const meta = '<html><head><meta property="video:release_date" content="2026-09-24T10:00:00+0000"></head><body><article><p>Text hier.</p></article></body></html>'
    expect(extractWebPage(meta, 'https://example.org/a').datePublished).toBe('2026-09-24')
    const time = '<html><body><article><time datetime="2026-09-23T08:00:00Z">23.09.</time><p>Text hier.</p></article></body></html>'
    expect(extractWebPage(time, 'https://example.org/b').datePublished).toBe('2026-09-23')
  })
})
