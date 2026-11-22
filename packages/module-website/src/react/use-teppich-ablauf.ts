'use client'

/**
 * Ablauf einer Frage auf dem Teppich der Dokumente (Plan `teppich-der-dokumente`, T3).
 *
 * Fuehrt `naechstePhase` mit der Zeit: merkt sich den Beginn der Suche, wartet die
 * Mindestdauer ab, auch wenn die Antwort frueher da ist, und nimmt das Ende des Flugs
 * von der Leinwand entgegen (`gelandet`). Ohne Teppich bleibt die Phase `ruhe`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { SUCHE_MINDESTENS_MS, naechstePhase, type TeppichAblaufEingabe, type TeppichPhase } from '..'

export function useTeppichAblauf(aktiv: boolean, e: TeppichAblaufEingabe): { phase: TeppichPhase; gelandet: () => void } {
  const [phase, setPhase] = useState<TeppichPhase>('ruhe')
  const [istGelandet, setIstGelandet] = useState(false)
  const [takt, setTakt] = useState(0)
  const beginn = useRef(0)
  const { laeuft, fehler, hatAntwort } = e

  useEffect(() => {
    if (!aktiv) return
    const jetzt = performance.now()
    if (laeuft && phase !== 'sucht') beginn.current = jetzt
    const naechste = naechstePhase(phase, { laeuft, fehler, hatAntwort }, jetzt - beginn.current, istGelandet)
    if (naechste !== phase) {
      if (naechste === 'landet') setIstGelandet(false)
      setPhase(naechste)
      return
    }
    // Die Antwort ist da, die Mindestdauer noch nicht um: danach noch einmal pruefen.
    if (phase === 'sucht' && !laeuft) {
      const id = setTimeout(() => setTakt((n) => n + 1), Math.max(0, SUCHE_MINDESTENS_MS - (jetzt - beginn.current)))
      return () => clearTimeout(id)
    }
  }, [aktiv, phase, laeuft, fehler, hatAntwort, istGelandet, takt])

  const gelandet = useCallback(() => setIstGelandet(true), [])
  return { phase: aktiv ? phase : 'ruhe', gelandet }
}
