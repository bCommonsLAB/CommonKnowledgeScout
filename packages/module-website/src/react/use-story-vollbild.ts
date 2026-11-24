'use client'

/**
 * Vollbild der Story-Sektion auf dem Telefon (R3, 24.11.2026).
 *
 * Wer auf dem Telefon eine Frage stellt, sieht den Ablauf bildschirmfuellend: oben die
 * Fragebox, in der Mitte die Punktwolke, unten das Statusblatt; danach die Antwort als
 * Leseansicht. Es ist DIESELBE Sektion, nur fest ueber den Bildschirm gelegt (kein Portal,
 * kein zweiter Baum) — Schliessen legt sie zurueck in die Seite, die Antwort steht dort inline.
 *
 * - Auf geht es mit einem Tipp in die Fragebox (`oeffnen`, R5: schreiben ueber der Tastatur) oder
 *   mit `laeuft` (eine angebotene Frage wurde gewaehlt), zu nur durch den Leser: mit dem Knopf
 *   oder der Zurueck-Taste (`useZurueckTaste`, wenn der Gastgeber sie anbietet).
 * - Solange das Vollbild steht, haelt der Anker die Hoehe der Sektion (die Seite darunter
 *   springt nicht) und die Seite scrollt nicht mit.
 */

import * as React from 'react'
import { useSchmal } from './use-schmal'
import { useZurueckTaste } from './use-ueberlagerung'
import type { WebsiteStoryGastgeber } from './website-story-gastgeber'

export interface StoryVollbild {
  vollbild: boolean
  /** Tipp in die Fragebox (R5): die Eingabe geht im Vollbild auf. Am Rechner und ohne festen Bildschirm ohne Wirkung. */
  oeffnen: () => void
  schliessen: () => void
  /** Stil des Ankers: haelt den Platz der Sektion, solange sie ueber dem Bildschirm liegt. */
  platz: React.CSSProperties | undefined
}

export function useStoryVollbild(
  anker: React.RefObject<HTMLElement | null>, laeuft: boolean, fest: boolean, zurueckTaste: WebsiteStoryGastgeber['zurueckTaste'],
): StoryVollbild {
  const schmal = useSchmal()
  const [offen, setOffen] = React.useState(false)
  const hoehe = React.useRef(0)
  // Haelt der Bildschirm die Sektion nicht fest (Embed in einem Behaelter mit `transform`), bleibt sie in der Seite.
  const vollbild = schmal && offen && fest

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

  const oeffnen = React.useCallback(() => { if (schmal && fest) setOffen(true) }, [schmal, fest])
  const schliessen = React.useCallback(() => {
    setOffen(false)
    // Das Feld gibt den Fokus ab: die Tastatur geht zu, und der naechste Tipp oeffnet das Vollbild wieder.
    const aktiv = document.activeElement
    if (aktiv instanceof HTMLElement && anker.current?.contains(aktiv)) aktiv.blur()
    // Zurueck in der Seite: die Fragebox steht oben im Bild, darunter die Antwort.
    requestAnimationFrame(() => anker.current?.scrollIntoView({ block: 'start' }))
  }, [anker])

  useZurueckTaste(zurueckTaste, vollbild, schliessen)

  return { vollbild, oeffnen, schliessen, platz: vollbild ? { minHeight: hoehe.current } : undefined }
}
