/**
 * @fileoverview HTML in einen einfachen Baum zerlegen — ohne DOM-Bibliothek.
 *
 * @description
 * `seite-markdown.ts` braucht Verschachtelung (Listen in Listen, Zellen in
 * Zeilen), die die Absatz-Suche per regulaerem Ausdruck (`page-extract.ts`)
 * nicht kennt. Der Zerleger ist nachsichtig wie ein Browser, soweit es fuer
 * Text zaehlt: nicht geschlossene `<p>`, `<li>`, `<td>`, `<tr>`, `<dt>`,
 * `<dd>` schliesst das naechste Geschwister; ein Ende-Tag ohne Anfang wird
 * uebergangen. Inhalte von `script`, `style` und Kommentare fallen weg.
 *
 * @module web-source
 */

import { decodeHtmlEntities, readAttribute } from './html-text'

export interface HtmlElement {
  tag: string
  /** Das rohe Start-Tag, fuer `attribut()`. */
  roh: string
  kinder: HtmlKnoten[]
}

export type HtmlKnoten = HtmlElement | string

const LEER = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const ROHTEXT = new Set(['script', 'style'])

/** Oeffnet `tag`, waehrend eines dieser Tags offen ist, wird das offene zuerst geschlossen — bis zur genannten Grenze. */
const SCHLIESST: Record<string, { offen: string[]; grenze: string[] }> = {
  p: { offen: ['p'], grenze: ['li', 'td', 'th', 'dd', 'blockquote', 'div', 'section', 'article'] },
  li: { offen: ['li'], grenze: ['ul', 'ol'] },
  dt: { offen: ['dt', 'dd'], grenze: ['dl'] },
  dd: { offen: ['dt', 'dd'], grenze: ['dl'] },
  tr: { offen: ['tr'], grenze: ['table'] },
  td: { offen: ['td', 'th'], grenze: ['tr', 'table'] },
  th: { offen: ['td', 'th'], grenze: ['tr', 'table'] },
}

/** Tags, vor denen ein offenes `<p>` endet (Blockelemente). */
const BEENDET_P = new Set(['ul', 'ol', 'dl', 'table', 'div', 'section', 'article', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'])

export function istElement(k: HtmlKnoten): k is HtmlElement {
  return typeof k !== 'string'
}

export function attribut(el: HtmlElement, name: string): string | undefined {
  return readAttribute(el.roh, name)
}

/** Zerlegt HTML in einen Baum; die Wurzel traegt den Tag `#wurzel`. */
export function zerlegeHtml(html: string): HtmlElement {
  const wurzel: HtmlElement = { tag: '#wurzel', roh: '', kinder: [] }
  const stapel: HtmlElement[] = [wurzel]
  const oben = (): HtmlElement => stapel[stapel.length - 1]
  const schliesseBis = (offen: string[], grenze: string[]): void => {
    for (let i = stapel.length - 1; i > 0; i--) {
      if (grenze.includes(stapel[i].tag)) return
      if (offen.includes(stapel[i].tag)) {
        stapel.length = i
        return
      }
    }
  }
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>|[^<]+|</g
  let rohBis: string | null = null
  for (const m of html.matchAll(re)) {
    const tag = m[2]?.toLowerCase()
    if (rohBis) {
      if (tag === rohBis && m[1] === '/') rohBis = null
      continue
    }
    if (!tag) {
      if (m[0].startsWith('<!')) continue
      const text = decodeHtmlEntities(m[0])
      if (text) oben().kinder.push(text)
      continue
    }
    if (m[1] === '/') {
      const i = stapel.map((e) => e.tag).lastIndexOf(tag)
      if (i > 0) stapel.length = i
      continue
    }
    if (ROHTEXT.has(tag)) {
      if (!/\/\s*$/.test(m[3])) rohBis = tag
      continue
    }
    const regel = SCHLIESST[tag]
    if (regel) schliesseBis(regel.offen, regel.grenze)
    if (BEENDET_P.has(tag)) schliesseBis(['p'], SCHLIESST.p.grenze)
    const el: HtmlElement = { tag, roh: m[0], kinder: [] }
    oben().kinder.push(el)
    if (!LEER.has(tag) && !/\/\s*>$/.test(m[0])) stapel.push(el)
  }
  return wurzel
}

/** Erstes Element mit diesem Tag (Tiefensuche), sonst null. */
export function findeErstes(el: HtmlElement, tag: string): HtmlElement | null {
  for (const k of el.kinder) {
    if (!istElement(k)) continue
    if (k.tag === tag) return k
    const tiefer = findeErstes(k, tag)
    if (tiefer) return tiefer
  }
  return null
}

/** Alle Elemente mit diesem Tag, in Dokumentreihenfolge. */
export function findeAlle(el: HtmlElement, tag: string, out: HtmlElement[] = []): HtmlElement[] {
  for (const k of el.kinder) {
    if (!istElement(k)) continue
    if (k.tag === tag) out.push(k)
    findeAlle(k, tag, out)
  }
  return out
}
