/**
 * @fileoverview Kleine HTML-Text-Helfer ohne DOM-Bibliothek (Server, Node).
 *
 * @description
 * Die Seiten-Extraktion (`page-extract.ts`) arbeitet auf dem rohen HTML mit
 * regulaeren Ausdruecken: Tags entfernen, Entities dekodieren, Whitespace
 * glaetten. Bewusst ohne jsdom (nur devDependency) — fuer Artikelseiten mit
 * `<article>`/`<p>` reicht das, und es laeuft im Worker wie in der Route.
 *
 * @module web-source
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  sbquo: '‚', euro: '€', copy: '©', reg: '®', shy: '',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
}

/** Dekodiert benannte, dezimale und hexadezimale HTML-Entities. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    const named = NAMED_ENTITIES[body]
    return named !== undefined ? named : match
  })
}

/** Entfernt alle Tags, dekodiert Entities und glaettet Whitespace zu einer Zeile. */
export function htmlToText(fragment: string): string {
  const ohneTags = fragment
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
  return decodeHtmlEntities(ohneTags).replace(/\s+/g, ' ').trim()
}

/**
 * Entfernt ganze Bloecke (script, style, nav, header, footer, aside, form, noscript, svg, template).
 * `keepHeader` laesst <header> stehen — innerhalb eines <article> traegt er den Vorspann.
 */
export function stripNonContentBlocks(html: string, options: { keepHeader?: boolean } = {}): string {
  const re = options.keepHeader
    ? /<(script|style|nav|footer|aside|form|noscript|svg|template)\b[\s\S]*?<\/\1>/gi
    : /<(script|style|nav|header|footer|aside|form|noscript|svg|template)\b[\s\S]*?<\/\1>/gi
  return html.replace(re, '')
}

/** Liest ein Attribut aus einem Start-Tag-String (doppelt oder einfach gequotet). */
export function readAttribute(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = tag.match(re)
  if (!m) return undefined
  return decodeHtmlEntities(m[1] ?? m[2] ?? '')
}

/** Alle `<meta ...>`-Tags mit property/name und content. */
export function readMetaTags(html: string): Array<{ key: string; content: string }> {
  const out: Array<{ key: string; content: string }> = []
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const key = readAttribute(tag, 'property') ?? readAttribute(tag, 'name')
    const content = readAttribute(tag, 'content')
    if (key && content !== undefined) out.push({ key: key.toLowerCase(), content })
  }
  return out
}
