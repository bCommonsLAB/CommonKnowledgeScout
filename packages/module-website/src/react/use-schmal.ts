'use client'

/**
 * Telefonbreite (unter Tailwinds `sm`, 640 px) — fuer Bausteine, die dort ein
 * anderes BEDIENMUSTER haben (Akkordeon statt offener Karten). Reines Layout
 * bleibt bei den `sm:`-Klassen; dieser Haken ist nur fuer Rollen und Zustand.
 *
 * Vor dem ersten Effekt (Server, erster Wurf) gilt `false`: die breite
 * Darstellung ist die Vorgabe, die schmale schaltet sich im Browser zu.
 */

import * as React from 'react'

const ABFRAGE = '(max-width: 639px)'

export function useSchmal(): boolean {
  const [schmal, setSchmal] = React.useState(false)
  React.useEffect(() => {
    // Ohne `matchMedia` (Testumgebung ohne Layout) gibt es keine Breite zu messen: es bleibt bei breit.
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(ABFRAGE)
    const lies = () => setSchmal(mq.matches)
    lies()
    mq.addEventListener('change', lies)
    return () => mq.removeEventListener('change', lies)
  }, [])
  return schmal
}
