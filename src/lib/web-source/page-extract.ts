/**
 * @fileoverview Webseite deterministisch auslesen: Metadaten, Artikeltext, Medien.
 *
 * @description
 * Kein Sprachmodell. Die Seite liefert selbst, was wir brauchen: Titel und
 * Beschreibung (Open Graph, `<title>`, `<h1>`), Datum und Bild (JSON-LD,
 * `article:published_time`, `og:image`), eingebettete Medien (JSON-LD
 * AudioObject/VideoObject `contentUrl`, `og:video`/`og:audio`, `<audio>`,
 * `<video>`, Player-iframes) und den Artikeltext als Absaetze aus dem
 * `<article>`-Block (sonst `<main>`, sonst `<body>`). Absaetze bleiben
 * woertlich; doppelte (Desktop/Mobile-Varianten) fallen weg. Was fehlt, ist
 * leer — nie geraten.
 *
 * @module web-source
 */

import { htmlToText, readAttribute, readMetaTags, stripNonContentBlocks } from './html-text'

export interface WebPageMedia {
  url: string
  art: 'audio' | 'video' | 'embed'
  herkunft: 'json-ld' | 'og' | 'tag'
}

export interface WebPageExtract {
  url: string
  title: string
  description: string
  siteName: string
  author: string
  /** YYYY-MM-DD oder leer. */
  datePublished: string
  imageUrl: string
  language: string
  /** Artikeltext in Lesereihenfolge: Absaetze, Ueberschriften (`## `), Zitate (`> `), Listen (`- `). */
  bloecke: string[]
  media: WebPageMedia[]
}

interface JsonLdNode {
  '@type'?: unknown
  name?: unknown
  headline?: unknown
  description?: unknown
  datePublished?: unknown
  uploadDate?: unknown
  contentUrl?: unknown
  embedUrl?: unknown
  thumbnailUrl?: unknown
  image?: unknown
  author?: unknown
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim()
  // Personen/Organisationen: Name vor URL (author { name, url }); Bilder: url.
  if (v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string') return String((v as { name: string }).name).trim()
  if (v && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string') return String((v as { url: string }).url).trim()
  return ''
}

function toIsoDate(raw: string): string {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function flattenJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = []
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim())
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        if (item && typeof item === 'object') {
          nodes.push(item as JsonLdNode)
          const graph = (item as { '@graph'?: unknown })['@graph']
          if (Array.isArray(graph)) for (const g of graph) if (g && typeof g === 'object') nodes.push(g as JsonLdNode)
        }
      }
    } catch {
      // Ungueltiges JSON-LD ist kein Fehler der Seite fuer uns — die Meta-Tags bleiben.
    }
  }
  return nodes
}

function typeOf(node: JsonLdNode): string {
  const t = node['@type']
  return (Array.isArray(t) ? String(t[0] ?? '') : String(t ?? '')).toLowerCase()
}

function absolute(raw: string, base: string): string {
  try {
    return new URL(raw, base).toString()
  } catch {
    return ''
  }
}

function pickContainer(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  if (article) return article[1]
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  if (main) return main[1]
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return body ? body[1] : html
}

/** Absaetze, Ueberschriften, Zitate und Listenpunkte in Dokumentreihenfolge, dedupliziert. */
export function extractTextBlocks(containerHtml: string): string[] {
  const out: string[] = []
  const gesehen = new Set<string>()
  const re = /<(p|h2|h3|h4|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi
  for (const m of containerHtml.matchAll(re)) {
    const tag = m[1].toLowerCase()
    const inner = tag === 'blockquote' ? m[2].replace(/<\/?p\b[^>]*>/gi, ' ') : m[2]
    const text = htmlToText(inner)
    if (!text || text.length < 2) continue
    // Kurze Listenpunkte sind fast immer Schlagwort-/Tag-Listen am Artikelende, kein Text.
    if (tag === 'li' && text.length < 40) continue
    const key = `${tag}:${text}`
    if (gesehen.has(key)) continue
    gesehen.add(key)
    if (tag === 'h2') out.push(`## ${text}`)
    else if (tag === 'h3' || tag === 'h4') out.push(`### ${text}`)
    else if (tag === 'blockquote') out.push(`> ${text}`)
    else if (tag === 'li') out.push(`- ${text}`)
    else out.push(text)
  }
  return out
}

function extractMedia(html: string, nodes: JsonLdNode[], url: string): WebPageMedia[] {
  const media: WebPageMedia[] = []
  const add = (raw: string, art: WebPageMedia['art'], herkunft: WebPageMedia['herkunft']) => {
    const abs = absolute(raw, url)
    if (abs && !media.some((m) => m.url === abs)) media.push({ url: abs, art, herkunft })
  }
  for (const n of nodes) {
    const t = typeOf(n)
    if (t === 'audioobject' || t === 'videoobject') {
      const c = asString(n.contentUrl)
      if (c) add(c, t === 'audioobject' ? 'audio' : 'video', 'json-ld')
      const e = asString(n.embedUrl)
      if (e) add(e, 'embed', 'json-ld')
    }
  }
  for (const { key, content } of readMetaTags(html)) {
    if (key === 'og:video' || key === 'og:video:url' || key === 'og:video:secure_url') add(content, 'video', 'og')
    if (key === 'og:audio' || key === 'og:audio:url' || key === 'og:audio:secure_url') add(content, 'audio', 'og')
  }
  for (const m of html.matchAll(/<(audio|video|source|iframe)\b[^>]*>/gi)) {
    const src = readAttribute(m[0], 'src')
    if (!src) continue
    const tag = m[1].toLowerCase()
    if (tag === 'iframe') {
      if (/youtube\.com\/embed|youtu\.be|vimeo\.com\/video|player\.vimeo|peertube|\/videos\/embed\//i.test(src)) add(src, 'embed', 'tag')
    } else {
      add(src, tag === 'audio' ? 'audio' : 'video', 'tag')
    }
  }
  return media
}

/** Liest Metadaten, Artikelbloecke und Medien aus dem HTML einer Seite. */
export function extractWebPage(html: string, url: string): WebPageExtract {
  const meta = readMetaTags(html)
  const og = (k: string): string => meta.find((m) => m.key === k)?.content.trim() ?? ''
  const nodes = flattenJsonLd(html)
  // Rangfolge nach Typ, nicht nach Reihenfolge im Dokument: In einem @graph steht die
  // WebPage oft vor dem VideoObject, traegt aber kein Datum (Befund Rai-Videoseite 13.10.).
  const TYP_RANG = ['newsarticle', 'article', 'videoobject', 'audioobject', 'webpage']
  const hauptknoten = TYP_RANG.map((t) => nodes.find((n) => typeOf(n) === t)).find((n) => n !== undefined)
  const knotenDatum = TYP_RANG.flatMap((t) => nodes.filter((n) => typeOf(n) === t))
    .map((n) => asString(n.datePublished) || asString(n.uploadDate))
    .find((d) => d !== '') ?? ''
  const timeTag = html.match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i)
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const htmlLang = html.match(/<html\b[^>]*\blang\s*=\s*["']([a-zA-Z-]+)["']/i)
  // Erst den Block waehlen, dann bereinigen: der eigene <header> eines <article>
  // traegt oft den Vorspann (erster Absatz) — der gehoert zum Text. Den Seitenkopf
  // mit Menue hat die Wahl von <article>/<main> schon ausgeschlossen.
  const gewaehlt = pickContainer(html)
  const container = /<article\b|<main\b/i.test(html) ? stripNonContentBlocks(gewaehlt, { keepHeader: true }) : stripNonContentBlocks(gewaehlt)
  return {
    url,
    title: og('og:title') || (h1 ? htmlToText(h1[1]) : '') || (titleTag ? htmlToText(titleTag[1]) : ''),
    description: og('og:description') || og('description') || asString(hauptknoten?.description),
    siteName: og('og:site_name'),
    author: asString(hauptknoten?.author) || og('author') || og('article:author'),
    datePublished: toIsoDate(
      og('article:published_time') || knotenDatum || og('video:release_date') || og('og:video:release_date') ||
        og('date') || (timeTag ? timeTag[1] : ''),
    ),
    imageUrl: absolute(og('og:image') || asString(hauptknoten?.thumbnailUrl) || asString(hauptknoten?.image), url),
    language: (og('og:locale') || (htmlLang ? htmlLang[1] : '')).split(/[_-]/)[0].toLowerCase(),
    bloecke: extractTextBlocks(container),
    media: extractMedia(html, nodes, url),
  }
}
