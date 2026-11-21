'use client'

/**
 * Ob und womit die Fragen-Sektion ueber der Common-UX-Buehne steht (Plan
 * `commonux-buehne-fragen-sektion`, P4).
 *
 * VORLAEUFIG, bis es den Schalter je Library gibt (K3): Die Buehne ist aus und geht nur mit
 * `?buehne=an` in der Adresse an. So laesst sie sich an jeder Library ansehen, ohne dass sich
 * fuer Besucher etwas aendert.
 *
 * Ruecksicht: keine Buehne hinter dem Text auf schmalen Bildschirmen und bei „Kontrast erhoehen".
 * „Bewegung reduzieren" regelt der Player selbst.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useQueryState } from 'nuqs'
import type { WebsiteStoryBuehne } from '@ks/module-website/react'

/** Ab dieser Breite liegt die Buehne hinter dem Text; darunter nicht, und nicht bei erhoehtem Kontrast. */
export const BUEHNE_MEDIUM = '(min-width: 768px) and (not (prefers-contrast: more))'

function abonniereMedium(horcher: () => void): () => void {
  const medium = window.matchMedia(BUEHNE_MEDIUM)
  medium.addEventListener('change', horcher)
  return () => medium.removeEventListener('change', horcher)
}

export function useWebsiteBuehne(): WebsiteStoryBuehne | undefined {
  const [wahl] = useQueryState('buehne')
  const passt = useSyncExternalStore(abonniereMedium, () => window.matchMedia(BUEHNE_MEDIUM).matches, () => false)
  const [buehne, setBuehne] = useState<WebsiteStoryBuehne | undefined>(undefined)

  useEffect(() => {
    if (wahl !== null && wahl !== 'an') console.error(`[WebsiteBuehne] Unbekannter Wert ?buehne=${wahl} — erwartet "an"`)
    if (wahl !== 'an' || !passt) {
      setBuehne(undefined)
      return
    }
    let abgebrochen = false
    import('./website-buehne')
      .then((m) => { if (!abgebrochen) setBuehne(m.WEBSITE_BUEHNE) })
      .catch((e: unknown) => console.error('[WebsiteBuehne] Der Player ist nicht ladbar — die Seite bleibt ohne Buehne', e))
    return () => { abgebrochen = true }
  }, [wahl, passt])

  return buehne
}
