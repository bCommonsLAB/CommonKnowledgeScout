/**
 * Wer ein Dokument der eingebetteten Startseite oeffnet (Banner-Karte, Beleg):
 * die eigene Detailansicht oder die Container-Anwendung.
 *
 * - Standard: Typen mit eingebetteter Ansicht (Buch, Testimonial, Blog) oeffnen
 *   in der eigenen Detailansicht, `hrefFor` wird fuer sie nicht gefragt; die
 *   uebrigen fuehren ueber `hrefFor` (Ziel `dokument`) hinaus.
 * - Mit `documentsViaHrefFor`: `hrefFor` wird fuer JEDEN Typ gefragt. Nennt die
 *   Container-Anwendung eine Adresse, oeffnet sie das Dokument selbst; bei
 *   `null` bleibt es beim Standard.
 *
 * Rein: fragt die Navigation, fuehrt nichts aus.
 */

import type { WebsiteNavigation, WebsiteZiel } from '@ks/module-website'

export type DokumentWeg =
  /** Die Container-Anwendung oeffnet das Dokument unter ihrer Adresse. */
  | { art: 'container'; ausfuehren: () => void }
  /** Die eigene Detailansicht oeffnet ueber dem Fenster. */
  | { art: 'eingebettet' }
  /** Weder Adresse noch eingebettete Ansicht — der Klick oeffnet nichts. */
  | { art: 'nichts'; grund: string }

export interface DokumentWegEingabe {
  /** Slug des Dokuments; `null`, wenn es keinen hat. */
  slug: string | null
  page?: number
  /** Hat der Typ des Dokuments eine eingebettete Detailansicht? */
  eingebettet: boolean
  /** Option `documentsViaHrefFor` der Startseite. */
  zuerstContainer: boolean
  navigation: WebsiteNavigation
}

export function dokumentWeg({ slug, page, eingebettet, zuerstContainer, navigation }: DokumentWegEingabe): DokumentWeg {
  if (eingebettet && !zuerstContainer) return { art: 'eingebettet' }
  if (slug === null) {
    // Ohne Slug gibt es kein Ziel, nach dem sich fragen liesse.
    return eingebettet ? { art: 'eingebettet' } : { art: 'nichts', grund: 'Dokument ohne Slug — nichts zu oeffnen' }
  }
  const ziel: WebsiteZiel = page ? { art: 'dokument', slug, seitenzahl: page } : { art: 'dokument', slug }
  const weg = navigation.weg(ziel)
  if (weg?.ausfuehren) return { art: 'container', ausfuehren: weg.ausfuehren }
  if (eingebettet) return { art: 'eingebettet' }
  return {
    art: 'nichts',
    grund: weg === null
      ? `Dokument "${slug}" hat in dieser Seite keine Adresse und keine eingebettete Detailansicht`
      : `Dokument "${slug}" hat nur eine Adresse (${weg.href}), keinen Wechsel`,
  }
}
