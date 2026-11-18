/**
 * Die Wege der eingebetteten Startseite (Plan `startseite-als-embed`, WE4):
 * `WebsiteNavigation` aus dem `hrefFor` der Container-Anwendung.
 *
 * - Jedes Ziel wird ein gewoehnlicher Link mit der Adresse aus `hrefFor`.
 *   Wo die Seite statt eines Links nur einen Klick hat (Beleg im Blatt,
 *   „alle Inhalte"), oeffnet derselbe Klick dieselbe Adresse.
 * - `null` aus `hrefFor` heisst: dafuer hat die Container-Anwendung keine
 *   Seite. Das Element entfaellt, die Seite meldet es einmal (Entscheid E).
 * - Eine relative Autoren-Adresse ausserhalb des Vokabulars (CTA, Markdown,
 *   z. B. `/kontakt`) hat in einer fremden Seite keine Bedeutung: keine
 *   Methode `fremd`, also entfaellt der Link mit Meldung (Plan 3.2).
 *
 * Rein bis auf den Wechsel, den der Aufrufer hereinreicht (`zuAdresse`).
 */

import type { SiteFontName } from '@ks/contracts'
import type { WebsiteNavigation, WebsiteZiel } from '@ks/module-website'
import type { KsZiel } from './typen'

export type HrefFor = (ziel: KsZiel) => string | null

export function embedSiteNavigation(hrefFor: HrefFor, zuAdresse: (href: string) => void): WebsiteNavigation {
  return {
    weg(ziel: WebsiteZiel) {
      let href: unknown
      try {
        href = hrefFor(ziel)
      } catch (e) {
        console.error(`[KnowledgeScoutSite] hrefFor warf fuer Ziel ${ziel.art} — das Element entfaellt`, e)
        return null
      }
      if (href === null) return null
      if (typeof href !== 'string' || href.trim() === '') {
        console.error(`[KnowledgeScoutSite] hrefFor lieferte fuer Ziel ${ziel.art} keine Adresse (${JSON.stringify(href)}) — erwartet ein String oder null`)
        return null
      }
      const adresse = href
      return { href: adresse, ausfuehren: () => zuAdresse(adresse) }
    },
  }
}

/**
 * Die Schriften des Design-Profils im Embed: die Familien aus `@ks/embed/styles.css`
 * (`@font-face`, Dateien liegen dem Paket bei). In der App setzt sie `next/font`.
 */
export const EMBED_SCHRIFTEN: Record<SiteFontName, string> = {
  geist: '"KS Geist", system-ui, sans-serif',
  newsreader: '"KS Newsreader", Georgia, serif',
  'plus-jakarta': '"KS Plus Jakarta Sans", system-ui, sans-serif',
  'source-sans': '"KS Source Sans 3", system-ui, sans-serif',
  'source-code': '"KS Source Code Pro", ui-monospace, monospace',
}

// Im Typecheck geprueft: Das Ziel-Vokabular des Embeds und das der Website sind dieselbe Form.
type Gleich<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const zieleGleich: Gleich<KsZiel, WebsiteZiel> = true
void zieleGleich
