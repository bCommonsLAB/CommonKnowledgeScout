/**
 * @fileoverview Kleine Bausteine von `seite-markdown.ts`: Bloecke verbinden, Feld-Paare erkennen.
 *
 * @module web-source
 */

import { attribut, istElement, type HtmlElement } from './html-baum'

/** Bloecke mit Leerzeile verbinden — aufeinanderfolgende Listenzeilen bleiben eine Liste. */
export function verbinde(bloecke: string[]): string {
  const istZeile = (b: string): boolean => /^(?: {2})*(?:-|\d+\.) /.test(b) && !b.includes('\n')
  return bloecke.map((b, i) => (i === 0 ? b : `${istZeile(b) && istZeile(bloecke[i - 1]) ? '\n' : '\n\n'}${b}`)).join('')
}

function hatKlasse(el: HtmlElement, muster: RegExp): boolean {
  return (attribut(el, 'class') ?? '').split(/\s+/).some((k) => muster.test(k))
}

const LABEL = /^(field__label|field-label)$/
const WERT = /^(field__items?|field-items?)$/

/**
 * Feld-Paar eines Redaktionssystems: ein Element mit genau einem Kind „Bezeichnung"
 * (Klasse `field__label` / `field-label`) und sonst nur Kindern „Wert" (`field__item(s)`).
 * So stehen Angaben einer Dokumentseite (Dokumenttyp, Datum, Sprache). Ohne diese
 * Erkennung kommen Bezeichnung und Wert als zwei lose Absaetze an (Befund der Abnahme).
 * Erkannt wird nur die ausdrueckliche Auszeichnung, nichts wird aus der Naehe geraten.
 */
export function feldPaar(el: HtmlElement): { label: HtmlElement; werte: HtmlElement[] } | null {
  const kinder = el.kinder.filter(istElement)
  const labels = kinder.filter((k) => hatKlasse(k, LABEL))
  const werte = kinder.filter((k) => hatKlasse(k, WERT))
  if (labels.length !== 1 || werte.length === 0 || labels.length + werte.length !== kinder.length) return null
  if (el.kinder.some((k) => !istElement(k) && k.trim() !== '')) return null
  return { label: labels[0], werte }
}
