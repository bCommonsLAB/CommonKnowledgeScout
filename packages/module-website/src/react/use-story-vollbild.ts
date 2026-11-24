'use client'

/**
 * Vollbild der Story-Sektion auf dem Telefon (R3, 24.11.2026).
 *
 * Wer auf dem Telefon eine Frage stellt, sieht den Ablauf bildschirmfuellend: oben die
 * Fragebox, in der Mitte die Punktwolke, unten das Statusblatt; danach die Antwort als
 * Leseansicht. Es ist DIESELBE Sektion, nur fest ueber den Bildschirm gelegt (kein Portal,
 * kein zweiter Baum) — Schliessen legt sie zurueck in die Seite, die Antwort steht dort inline.
 *
 * - Auf geht es mit `laeuft` (eine Frage wurde gestellt), zu nur durch den Leser.
 * - Solange das Vollbild steht, haelt der Anker die Hoehe der Sektion (die Seite darunter
 *   springt nicht) und die Seite scrollt nicht mit.
 */

import * as React from 'react'
import { useSchmal } from './use-schmal'

export interface StoryVollbild {
  vollbild: boolean
  schliessen: () => void
  /** Stil des Ankers: haelt den Platz der Sektion, solange sie ueber dem Bildschirm liegt. */
  platz: React.CSSProperties | undefined
}

export function useStoryVollbild(anker: React.RefObject<HTMLElement | null>, laeuft: boolean): StoryVollbild {
  const schmal = useSchmal()
  const [offen, setOffen] = React.useState(false)
  const hoehe = React.useRef(0)
  const vollbild = schmal && offen

  React.useEffect(() => {
    if (schmal && laeuft) setOffen(true)
  }, [schmal, laeuft])

  // Die Hoehe der Sektion in der Seite, gemessen solange sie dort liegt.
  React.useLayoutEffect(() => {
    if (!vollbild && anker.current) hoehe.current = anker.current.offsetHeight
  })

  React.useEffect(() => {
    if (!vollbild) return
    const wurzel = document.documentElement
    const vorher = wurzel.style.overflow
    wurzel.style.overflow = 'hidden'
    return () => { wurzel.style.overflow = vorher }
  }, [vollbild])

  const schliessen = React.useCallback(() => {
    setOffen(false)
    // Zurueck in der Seite: die Fragebox steht oben im Bild, darunter die Antwort.
    requestAnimationFrame(() => anker.current?.scrollIntoView({ block: 'start' }))
  }, [anker])

  return { vollbild, schliessen, platz: vollbild ? { minHeight: hoehe.current } : undefined }
}
