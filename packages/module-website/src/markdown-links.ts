/**
 * Links im gerenderten Sektions-Markdown laufen ueber die Navigation (WE2).
 *
 * Der Markdown-Renderer (`md` aus `@ks/viewers`) liefert HTML; seine Links
 * schrieben bis WE2 die rohe Autoren-Adresse (`?site=kontakt`) in die Seite.
 * Im Embed gehoert dort die Adresse der Container-Seite hin. Diese Funktion
 * schreibt jedes `<a href>` um und sammelt die Klicks ohne Neuladen:
 *
 * - Ziel des Vokabulars → `navigation.weg(ziel)`; ohne Weg entfaellt der Link,
 *   der Text bleibt.
 * - absolute Adresse (`https:`, `mailto:`, `tel:`) → unveraendert.
 * - fremde relative Adresse → `navigation.fremd(href)`; ohne Antwort entfaellt
 *   der Link, der Text bleibt.
 *
 * Rein, ohne React und DOM: Es geht nur um die Links, die der Renderer selbst
 * schreibt (`<a href="…" …>…</a>`, Attribute in doppelten Anfuehrungszeichen).
 */

import { autorenLink, wegFehltMelden, type WebsiteNavigation } from './navigation'

export interface MarkdownMitWegen {
  html: string
  /** Klick ohne Neuladen je umgeschriebener Adresse (`href` wie im HTML, entschluesselt). */
  klicks: Map<string, () => void>
}

const ANKER = /<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g

const ENTITAETEN: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" }

function entschluesseln(wert: string): string {
  return wert.replace(/&(amp|quot|lt|gt|#39);/g, (e) => ENTITAETEN[e])
}

function verschluesseln(wert: string): string {
  return wert.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markdownLinksUeberNavigation(html: string, navigation: WebsiteNavigation): MarkdownMitWegen {
  const klicks = new Map<string, () => void>()
  const neu = html.replace(ANKER, (ganz: string, rohHref: string, rest: string, text: string) => {
    const href = entschluesseln(rohHref)
    const link = autorenLink(href)
    if (link.art === 'extern') return ganz
    if (link.art === 'fremd') {
      const ziel = navigation.fremd ? navigation.fremd(link.href) : null
      if (ziel === null) {
        wegFehltMelden(`Link "${href}" im Sektions-Markdown hat in dieser Seite keine Adresse — entfaellt`)
        return text
      }
      return `<a href="${verschluesseln(ziel)}"${rest}>${text}</a>`
    }
    const weg = navigation.weg(link.ziel)
    if (weg === null) {
      wegFehltMelden(`Link "${href}" im Sektions-Markdown (Ziel ${link.ziel.art}) hat in dieser Seite keine Adresse — entfaellt`)
      return text
    }
    if (weg.ausfuehren) klicks.set(weg.href, weg.ausfuehren)
    return `<a href="${verschluesseln(weg.href)}"${rest}>${text}</a>`
  })
  return { html: neu, klicks }
}
