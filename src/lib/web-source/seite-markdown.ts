/**
 * @fileoverview Seite woertlich als Markdown: Ueberschriften, Absaetze, Listen,
 * Tabellen, Definitionslisten — und alle Links mit ihrem Platz auf der Seite.
 *
 * @description
 * Anders als `page-extract.ts` (Artikeltext: kurze Listenpunkte und doppelte
 * Absaetze fallen weg) wird hier NICHTS gefiltert und nichts zusammengefasst.
 * Eine Rednerliste mit 34 Zeilen kommt mit 34 Zeilen zurueck, jeder Link in
 * der Zeile, in der er steht. Kein Sprachmodell.
 *
 * Inhaltsbereich: `<main>`, sonst das einzige `<article>`, sonst `<body>`;
 * Navigation, Fuss, Randspalte und Formulare bleiben draussen. Mit
 * `ganzeSeite` kommt der ganze `<body>`.
 *
 * @module web-source
 */

import { attribut, findeAlle, findeErstes, istElement, zerlegeHtml, type HtmlElement, type HtmlKnoten } from './html-baum'
import { linkAdresse, linkArt, type SeitenLink } from './seite-links'

export interface SeitenMarkdown {
  markdown: string
  links: SeitenLink[]
  /** Woraus gelesen wurde. */
  bereich: 'main' | 'article' | 'body'
}

const NIE = new Set(['head', 'noscript', 'svg', 'template', 'iframe', 'object', 'canvas', 'select', 'button', 'dialog'])
const RAHMEN = new Set(['nav', 'footer', 'aside', 'form'])
const BLOCK = new Set([
  'address', 'article', 'blockquote', 'details', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'ul', 'aside',
])
const KONTEXT_MAX = 300

interface Lauf {
  basis: string
  ganzeSeite: boolean
  links: SeitenLink[]
  abschnitt: string
  bloecke: string[]
}

function uebergangen(el: HtmlElement, lauf: Lauf): boolean {
  return NIE.has(el.tag) || (!lauf.ganzeSeite && RAHMEN.has(el.tag))
}

function hatBlock(el: HtmlElement): boolean {
  return el.kinder.some((k) => istElement(k) && (BLOCK.has(k.tag) || hatBlock(k)))
}

function glatt(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Fliesstext eines Knotens; Links werden `[Text](Adresse)` und in `lauf.links` vermerkt. `ohne` laesst Kind-Tags aus (Unterlisten). */
function inline(knoten: HtmlKnoten[], lauf: Lauf, ohne: Set<string> = new Set()): string {
  let out = ''
  for (const k of knoten) {
    if (!istElement(k)) {
      out += k
      continue
    }
    if (uebergangen(k, lauf) || ohne.has(k.tag)) continue
    if (k.tag === 'br') {
      out += ' '
      continue
    }
    const innen = inline(k.kinder, lauf, ohne)
    if (k.tag !== 'a') {
      // Blockgrenzen innerhalb eines Fliesstexts (div in li, p in td) bleiben als Leerraum sichtbar.
      out += BLOCK.has(k.tag) || k.tag === 'td' || k.tag === 'th' ? ` ${innen} ` : innen
      continue
    }
    const text = glatt(innen)
    const url = linkAdresse(attribut(k, 'href') ?? '', lauf.basis)
    if (!url) {
      out += innen
      continue
    }
    const bezeichnung = text || glatt(attribut(k, 'title') ?? '') || glatt(attribut(k, 'aria-label') ?? '')
    lauf.links.push({ nr: lauf.links.length + 1, text: bezeichnung, url, art: linkArt(url), abschnitt: lauf.abschnitt, kontext: '' })
    out += `[${(bezeichnung || url).replace(/[[\]]/g, '\\$&')}](${url.replace(/[()\s]/g, encodeURIComponent)})`
  }
  return out
}

/** Schreibt einen Block und gibt den seit `abLink` gefundenen Links seinen Text als Kontext mit. */
function block(lauf: Lauf, markdown: string, abLink: number): void {
  const text = markdown.trimEnd()
  if (!text.trim()) return
  lauf.bloecke.push(text)
  const kontext = glatt(text.replace(/\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, '$1').replace(/^[#>\-|\d. ]+/, ''))
  for (let i = abLink; i < lauf.links.length; i++) lauf.links[i].kontext = kontext.length > KONTEXT_MAX ? `${kontext.slice(0, KONTEXT_MAX)}…` : kontext
}

function liste(el: HtmlElement, lauf: Lauf, tiefe: number): void {
  let nummer = 0
  for (const li of el.kinder) {
    if (!istElement(li) || li.tag !== 'li') continue
    nummer++
    const ab = lauf.links.length
    const text = glatt(inline(li.kinder, lauf, new Set(['ul', 'ol'])))
    if (text) block(lauf, `${'  '.repeat(tiefe)}${el.tag === 'ol' ? `${nummer}.` : '-'} ${text}`, ab)
    for (const unter of li.kinder) if (istElement(unter) && (unter.tag === 'ul' || unter.tag === 'ol')) liste(unter, lauf, tiefe + 1)
  }
}

function tabelle(el: HtmlElement, lauf: Lauf): void {
  const zeilen = findeAlle(el, 'tr')
  let spalten = 0
  const fertig: Array<{ md: string; ab: number }> = []
  for (const tr of zeilen) {
    const ab = lauf.links.length
    const zellen = tr.kinder.filter((k): k is HtmlElement => istElement(k) && (k.tag === 'td' || k.tag === 'th'))
      .map((z) => glatt(inline(z.kinder, lauf)).replace(/\|/g, '\\|'))
    if (zellen.length === 0) continue
    spalten = Math.max(spalten, zellen.length)
    fertig.push({ md: `| ${zellen.join(' | ')} |`, ab })
  }
  if (fertig.length === 0) return
  // Eine Tabelle ist EIN Block (Leerzeilen wuerden sie zerreissen); der Kontext gilt je Zeile.
  const start = lauf.bloecke.length
  fertig.forEach((z, i) => {
    block(lauf, z.md, z.ab)
    if (i === 0) lauf.bloecke.push(`|${' --- |'.repeat(spalten)}`)
  })
  lauf.bloecke.splice(start, lauf.bloecke.length - start, lauf.bloecke.slice(start).join('\n'))
}

function definitionen(el: HtmlElement, lauf: Lauf): void {
  let begriff = ''
  for (const k of el.kinder) {
    if (!istElement(k)) continue
    // Seiten gruppieren dt/dd gern in <div> — die Gruppe wird wie die Liste selbst gelesen.
    if (k.tag === 'div') definitionen(k, lauf)
    const ab = lauf.links.length
    if (k.tag === 'dt') begriff = glatt(inline(k.kinder, lauf))
    if (k.tag === 'dd') block(lauf, `- **${begriff}:** ${glatt(inline(k.kinder, lauf))}`, ab)
  }
}

function gehe(knoten: HtmlKnoten[], lauf: Lauf): void {
  let fliess: HtmlKnoten[] = []
  const spuele = (): void => {
    if (fliess.length === 0) return
    const ab = lauf.links.length
    block(lauf, glatt(inline(fliess, lauf)), ab)
    fliess = []
  }
  for (const k of knoten) {
    if (!istElement(k) || k.tag === 'a' || (!BLOCK.has(k.tag) && !hatBlock(k))) {
      if (!istElement(k) || !uebergangen(k, lauf)) fliess.push(k)
      continue
    }
    spuele()
    if (uebergangen(k, lauf)) continue
    const ab = lauf.links.length
    const ebene = k.tag.match(/^h([1-6])$/)
    if (ebene) {
      const text = glatt(inline(k.kinder, lauf))
      lauf.abschnitt = glatt(text.replace(/\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, '$1'))
      block(lauf, `${'#'.repeat(Number(ebene[1]))} ${text}`, ab)
    } else if (k.tag === 'ul' || k.tag === 'ol') liste(k, lauf, 0)
    else if (k.tag === 'table') tabelle(k, lauf)
    else if (k.tag === 'dl') definitionen(k, lauf)
    else if (k.tag === 'pre') block(lauf, `\`\`\`\n${inline(k.kinder, lauf).replace(/^\n+|\s+$/g, '')}\n\`\`\``, ab)
    else if (k.tag === 'blockquote') block(lauf, `> ${glatt(inline(k.kinder, lauf))}`, ab)
    else if (k.tag === 'hr') continue
    else if (k.tag === 'p' || !hatBlock(k)) block(lauf, glatt(inline(k.kinder, lauf)), ab)
    else gehe(k.kinder, lauf)
  }
  spuele()
}

/** Bloecke mit Leerzeile verbinden — aufeinanderfolgende Listenzeilen bleiben eine Liste. */
function verbinde(bloecke: string[]): string {
  const istZeile = (b: string): boolean => /^(?: {2})*(?:-|\d+\.) /.test(b) && !b.includes('\n')
  return bloecke.map((b, i) => (i === 0 ? b : `${istZeile(b) && istZeile(bloecke[i - 1]) ? '\n' : '\n\n'}${b}`)).join('')
}

/** Wandelt das HTML einer Seite in woertliches Markdown und eine Linkliste. `basis` loest relative Links auf. */
export function seiteAlsMarkdown(html: string, basis: string, optionen: { ganzeSeite?: boolean } = {}): SeitenMarkdown {
  const wurzel = zerlegeHtml(html)
  const basisTag = findeErstes(wurzel, 'base')
  const basisHref = basisTag ? attribut(basisTag, 'href') : undefined
  const lauf: Lauf = { basis: basisHref ? new URL(basisHref, basis).toString() : basis, ganzeSeite: optionen.ganzeSeite === true, links: [], abschnitt: '', bloecke: [] }
  const body = findeErstes(wurzel, 'body') ?? wurzel
  const main = findeErstes(body, 'main')
  const artikel = findeAlle(body, 'article')
  let start: HtmlElement = body
  let bereich: SeitenMarkdown['bereich'] = 'body'
  if (!lauf.ganzeSeite && main) [start, bereich] = [main, 'main']
  else if (!lauf.ganzeSeite && artikel.length === 1) [start, bereich] = [artikel[0], 'article']
  // Der Seitenkopf mit Menue gehoert nicht zum Inhalt; der Kopf eines <main>/<article> schon (Titel, Vorspann).
  const kinder = bereich === 'body' && !lauf.ganzeSeite ? start.kinder.filter((k) => !istElement(k) || k.tag !== 'header') : start.kinder
  gehe(kinder, lauf)
  return { markdown: verbinde(lauf.bloecke), links: lauf.links, bereich }
}
