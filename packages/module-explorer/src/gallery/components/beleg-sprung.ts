'use client'

/**
 * Sprung zur Belegkarte aus der Story-Mitte (D12e).
 *
 * Seit D11b steht die Belegliste nur im DOM, wenn die Quellen-Schicht offen
 * ist. Klickt jemand bei zugeklappten Quellen auf eine Zitatmarke ①…, findet
 * `AntwortText` keine Karte und sendet `STORY_BELEG_ZEIGEN_EVENT`. Dieser
 * Hook (im Gastgeber, `GalleryRoot`) oeffnet die Schicht und scrollt, sobald
 * die Karte gerendert ist. Gibt es sie auch dann nicht (Mobil: dort liegen
 * die Belege im Blatt; alte Antwort ohne diese Marke), wird das gemeldet,
 * nicht verschluckt.
 */

import { useEffect, useState } from 'react'
import { STORY_BELEG_ZEIGEN_EVENT, type StoryBelegZeigenDetail } from '@ks/contracts'
import type { QuellenOffenZustand } from './quellen-leiste'

export function useBelegSprung(leiste: QuellenOffenZustand): void {
  const [ziel, setZiel] = useState<string | null>(null)
  const { offen, oeffnen } = leiste

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
