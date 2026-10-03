'use client'

/**
 * Sprung zur Belegkarte aus der Story-Mitte (D12e).
 *
 * Seit D11b steht die Belegliste nur im DOM, wenn die Quellen-Schicht offen
 * ist. Klickt jemand bei zugeklappten Quellen auf eine Zitatmarke ①…, findet
 * `AntwortText` keine Karte und sendet `STORY_BELEG_ZEIGEN_EVENT`. Dieser
 * Hook (im Gastgeber, `GalleryRoot`) oeffnet das Ziel und scrollt, sobald die
 * Karte gerendert ist. Das Ziel ist am Desktop die Quellen-Schicht, auf Mobil
 * das Blatt mit den Belegen (D4; D12i) — der Gastgeber reicht `offen` und
 * `oeffnen` des passenden Ziels herein. Gibt es die Karte auch dann nicht
 * (alte Antwort ohne diese Marke), wird das gemeldet, nicht verschluckt.
 */

import { useEffect, useState } from 'react'
import { STORY_BELEG_ZEIGEN_EVENT, type StoryBelegZeigenDetail } from '@ks/contracts'
import type { QuellenOffenZustand } from './quellen-leiste'

/** Wohin der Sprung geht: offen? und wie oeffnen (Schicht am Desktop, Blatt auf Mobil). */
export type BelegSprungZiel = Pick<QuellenOffenZustand, 'offen' | 'oeffnen'>

export function useBelegSprung(sprungZiel: BelegSprungZiel): void {
  const [ziel, setZiel] = useState<string | null>(null)
  const { offen, oeffnen } = sprungZiel

  useEffect(() => {
    const onZeigen = (e: Event) => {
      const marke = (e as CustomEvent<StoryBelegZeigenDetail>).detail?.marke
      if (typeof marke !== 'string' || marke === '') {
        console.warn('[useBelegSprung] Ereignis ohne Marke', e)
        return
      }
      setZiel(marke)
      oeffnen()
    }
    window.addEventListener(STORY_BELEG_ZEIGEN_EVENT, onZeigen)
    return () => window.removeEventListener(STORY_BELEG_ZEIGEN_EVENT, onZeigen)
  }, [oeffnen])

  // Nach dem Oeffnen steht die Karte im DOM — jetzt scrollen.
  useEffect(() => {
    if (ziel === null || !offen) return
    const karte = document.getElementById(`beleg-${ziel}`)
    if (karte) karte.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    else console.warn('[useBelegSprung] Keine Belegkarte zur Marke gefunden', { marke: ziel })
    setZiel(null)
  }, [ziel, offen])
}
