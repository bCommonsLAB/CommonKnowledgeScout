/**
 * @fileoverview Eine Seite lesen, ohne etwas zu schreiben: Metadaten, woertliches
 * Markdown, Links, genannte Medien.
 *
 * @description
 * Gemeinsamer Kern von `seite_lesen` (Bruecke) und dem Struktur-Modus von
 * `webseite_erschliessen`. Kein Sprachmodell, kein JavaScript: Gelesen wird
 * das HTML, das der Server ausliefert. Baut eine Seite ihren Inhalt erst im
 * Browser auf, ist das Markdown leer — das steht dann als Hinweis im
 * Ergebnis, es wird nichts ersatzweise erfunden.
 *
 * @module web-source
 */

import { extractWebPage, type WebPageExtract } from './page-extract'
import { ladeSeite } from './seite-laden'
import type { SeitenLink } from './seite-links'
import { seiteAlsMarkdown, type SeitenMarkdown } from './seite-markdown'

export interface GeleseneSeite {
  /** Die genannte Adresse. */
  adresse: string
  /** Adresse nach Umleitungen; relative Links sind gegen sie aufgeloest. */
  endAdresse: string
  /** Titel, Beschreibung, Quelle, Autor, Datum, Sprache, Bild und genannte Medien (Open Graph, JSON-LD, Tags). */
  meta: WebPageExtract
  markdown: string
  links: SeitenLink[]
  bereich: SeitenMarkdown['bereich']
  hinweise: string[]
}

export const HINWEIS_OHNE_TEXT =
  'Das HTML der Seite traegt keinen lesbaren Text — vermutlich baut die Seite ihren Inhalt erst im Browser auf (JavaScript). ' +
  'Das Rendern solcher Seiten kann die Bruecke noch nicht.'

/** Baut das Leseergebnis aus schon geladenem HTML (auch fuer Tests). */
export function leseSeiteAusHtml(html: string, adresse: string, endAdresse: string, optionen: { ganzeSeite?: boolean } = {}): GeleseneSeite {
  const meta = extractWebPage(html, endAdresse)
  const { markdown, links, bereich } = seiteAlsMarkdown(html, endAdresse, optionen)
  const hinweise: string[] = []
  if (!markdown.trim()) hinweise.push(HINWEIS_OHNE_TEXT)
  if (endAdresse !== adresse) hinweise.push(`Umgeleitet nach ${endAdresse}`)
  return { adresse, endAdresse, meta, markdown, links, bereich, hinweise }
}

/** Laedt die Seite (sicherer Abruf) und liest sie. Wirft, wenn sie nicht ladbar oder kein HTML ist. */
export async function leseSeite(adresse: string, optionen: { ganzeSeite?: boolean } = {}): Promise<GeleseneSeite> {
  const { html, endAdresse } = await ladeSeite(adresse)
  return leseSeiteAusHtml(html, adresse, endAdresse, optionen)
}
