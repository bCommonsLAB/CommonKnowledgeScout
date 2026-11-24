/**
 * @fileoverview Eine Seite lesen, ohne etwas zu schreiben: Metadaten, woertliches
 * Markdown, Links, genannte Medien.
 *
 * @description
 * Gemeinsamer Kern von `seite_lesen` (Bruecke) und dem Struktur-Modus von
 * `webseite_erschliessen`. Kein Sprachmodell, kein JavaScript: Gelesen wird
 * das HTML, das der Server ausliefert — oder HTML, das der Aufrufer uebergibt
 * (eine im Browser geoeffnete Seite, wenn die Website den Server abweist).
 * Traegt das HTML keinen Text, ist das Markdown leer; `leereAntwort` ordnet
 * ein, warum (leere-antwort.ts). Es wird nichts ersatzweise erfunden.
 *
 * @module web-source
 */

import { deuteLeereAntwort, type LeereAntwort } from './leere-antwort'
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
  /** Woher das HTML kam: vom Server geladen oder vom Aufrufer uebergeben (z. B. aus einem Browser). */
  herkunft: 'geladen' | 'uebergeben'
  /** Nur wenn das Markdown leer ist: Einordnung der Antwort mit Laenge und Anfang des rohen HTML. */
  leereAntwort?: LeereAntwort
}

export interface LeseOptionen {
  ganzeSeite?: boolean
  /** Fertiges HTML der Seite — dann wird NICHT geladen; `adresse` ist Herkunft und Basis der Links. */
  html?: string
}

/** Obergrenze fuer uebergebenes HTML (Zeichen). */
export const MAX_HTML_ZEICHEN = 3_000_000

/** Baut das Leseergebnis aus schon vorliegendem HTML. */
export function leseSeiteAusHtml(html: string, adresse: string, endAdresse: string, optionen: { ganzeSeite?: boolean } = {}, herkunft: GeleseneSeite['herkunft'] = 'geladen'): GeleseneSeite {
  const meta = extractWebPage(html, endAdresse)
  const { markdown, links, bereich } = seiteAlsMarkdown(html, endAdresse, optionen)
  const hinweise: string[] = []
  const leereAntwort = markdown.trim() ? undefined : deuteLeereAntwort(html)
  if (leereAntwort) hinweise.push(leereAntwort.hinweis)
  if (endAdresse !== adresse) hinweise.push(`Umgeleitet nach ${endAdresse}`)
  if (herkunft === 'uebergeben') hinweise.push('Das HTML wurde uebergeben, nicht vom Server geladen — sein Stand ist der des Aufrufers')
  return { adresse, endAdresse, meta, markdown, links, bereich, hinweise, herkunft, ...(leereAntwort ? { leereAntwort } : {}) }
}

/** Liest die Seite: uebergebenes HTML, sonst sicherer Abruf. Wirft, wenn sie nicht ladbar oder kein HTML ist. */
export async function leseSeite(adresse: string, optionen: LeseOptionen = {}): Promise<GeleseneSeite> {
  if (optionen.html !== undefined) {
    if (optionen.html.length > MAX_HTML_ZEICHEN) throw new Error(`Uebergebenes HTML ist ${optionen.html.length} Zeichen lang (Grenze ${MAX_HTML_ZEICHEN})`)
    const url = new URL(adresse)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`url muss http/https sein, nicht "${url.protocol}"`)
    return leseSeiteAusHtml(optionen.html, adresse, adresse, optionen, 'uebergeben')
  }
  const { html, endAdresse } = await ladeSeite(adresse)
  return leseSeiteAusHtml(html, adresse, endAdresse, optionen)
}
