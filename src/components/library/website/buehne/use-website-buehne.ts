'use client'

/**
 * Die Common-UX-Buehne der Fragen-Sektion in der App (Plan `commonux-buehne-fragen-sektion`,
 * P4 und K4): der Zustand in der Adresse und das Laden des Players bei Bedarf.
 *
 * `?buehne=` fehlt: aus — die Seite wie immer, im Kopf der Karte das Symbol „Zur Buehne".
 * `?buehne=vorn`: die Buehne statt des Texts. `?buehne=an`: die Buehne blass hinter dem Text
 * (dorthin fuehrt das Symbol „Zurueck zum Text"). Der Player wird erst geladen, wenn die Buehne
 * an ist.
 *
 * Schalter je Library (K3, `publicPublishing.stageEnabled`, Vorgabe aus): Ohne ihn gibt es weder
 * Symbol noch Buehne, auch nicht ueber die Adresse.
 *
 * Ruecksicht: keine Buehne und kein Symbol auf schmalen Bildschirmen und bei „Kontrast erhoehen".
 * „Bewegung reduzieren" regelt der Player selbst.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useQueryState } from 'nuqs'
import type { WebsiteBuehneModus, WebsiteStoryBuehne } from '@ks/module-website/react'

/** Ab dieser Breite gibt es die Buehne; darunter nicht, und nicht bei erhoehtem Kontrast. */
export const BUEHNE_MEDIUM = '(min-width: 768px) and (not (prefers-contrast: more))'

function abonniereMedium(horcher: () => void): () => void {
  const medium = window.matchMedia(BUEHNE_MEDIUM)
  medium.addEventListener('change', horcher)
  return () => medium.removeEventListener('change', horcher)
}

/** Wert von `?buehne=` → Zustand. Ein unbekannter Wert ist ein Fehler, kein stilles „aus". */
export function buehnenModus(wahl: string | null): WebsiteBuehneModus {
  if (wahl === null) return 'aus'
  if (wahl === 'an') return 'hinten'
  if (wahl === 'vorn') return 'vorn'
  throw new Error(`Unbekannter Wert ?buehne=${wahl} — erwartet "an" oder "vorn"`)
}

type Darstellung = NonNullable<WebsiteStoryBuehne['darstellung']>

export function useWebsiteBuehne(erlaubt: boolean): WebsiteStoryBuehne | undefined {
  const [wahl, setWahl] = useQueryState('buehne', { history: 'push' })
  const passt = useSyncExternalStore(abonniereMedium, () => window.matchMedia(BUEHNE_MEDIUM).matches, () => false)
  const [darstellung, setDarstellung] = useState<Darstellung | undefined>(undefined)

  const modus = useMemo<WebsiteBuehneModus>(() => {
    try {
      return buehnenModus(wahl)
    } catch (e) {
      // Laut melden und die Seite ohne Buehne zeigen — eine vertippte Adresse soll sie nicht brechen.
      console.error('[WebsiteBuehne]', e)
      return 'aus'
    }
  }, [wahl])

  const an = erlaubt && passt && modus !== 'aus'
  useEffect(() => {
    if (!an) return
    let abgebrochen = false
    import('./website-buehne')
      .then((m) => { if (!abgebrochen) setDarstellung(m.WEBSITE_BUEHNE) })
      .catch((e: unknown) => console.error('[WebsiteBuehne] Der Player ist nicht ladbar — die Seite bleibt ohne Buehne', e))
    return () => { abgebrochen = true }
  }, [an])

  const onModus = useCallback((neu: 'hinten' | 'vorn') => void setWahl(neu === 'vorn' ? 'vorn' : 'an'), [setWahl])

  return useMemo(
    () => (erlaubt && passt ? { modus, onModus, darstellung: an ? darstellung : undefined } : undefined),
    [erlaubt, passt, modus, onModus, an, darstellung],
  )
}
