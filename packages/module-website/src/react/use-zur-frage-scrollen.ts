'use client'

/**
 * Zur Frage scrollen (Owner 23.11.2026): Wer eine Frage absendet — auch eine Folgefrage unten
 * in der Eingabe —, sieht sofort den Ort, an dem Frage, Rechenweg und spaeter die Antwort stehen:
 * den Anfang der Fragen-Sektion. Sonst blieb der Bildschirm unten stehen, waehrend sich alles
 * weiter oben abspielte.
 */

import * as React from 'react'
import type { TeppichPhase } from '..'

export function useZurFrageScrollen(huelle: React.RefObject<HTMLElement | null>, phase: TeppichPhase, bewegung: boolean): void {
  const vorher = React.useRef(phase)
  React.useEffect(() => {
    const war = vorher.current
    vorher.current = phase
    if (phase !== 'sucht' || war === 'sucht') return
    const sektion = huelle.current?.closest('[data-website-story]')
    if (!sektion) {
      console.warn('[WebsiteTeppich] Fragen-Sektion nicht gefunden, kein Scrollen zur Frage')
      return
    }
    // Nur wenn ihr Anfang nicht schon oben im Bild steht.
    const oben = sektion.getBoundingClientRect().top
    if (oben >= 0 && oben < 80) return
    sektion.scrollIntoView({ behavior: bewegung ? 'smooth' : 'auto', block: 'start' })
  }, [phase, huelle, bewegung])
}
