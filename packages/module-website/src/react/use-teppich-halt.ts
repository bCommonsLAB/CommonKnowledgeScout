'use client'

/**
 * Wo der Teppich steht und wie viel Platz die Zone der Antwort haelt (Plan
 * `teppich-der-dokumente`, Owner 23.11.2026: „nicht das ganze Layout dauernd zappeln, sondern es
 * baut sich nach unten die Antwort auf und wird dann auch so die Grafik eingeblendet").
 *
 * - **Lage:** Die Leinwand liegt oben buendig mit der Zone der Antwort (`data-story-karten-modus`,
 *   die Konversation der Sektion) und scrollt mit der Seite. Gibt es noch keine Antwort (vor der
 *   ersten Frage), liegt sie oben in der Sektion.
 * - **Einblenden statt Verschieben:** Wechselt die Lage weit (erste Frage: von oben in der Sektion
 *   an die Zone der Antwort), erscheint die Wolke dort durch Einblenden.
 * - **Platz:** Die Zone haelt mindestens die Hoehe der Wolke (`--teppich-platz` an der Sektion, der
 *   Rahmen macht daraus die Mindesthoehe), also ragt die Wolke nie aus der Sektion. Bei einer neuen
 *   Frage ist das genau die Hoehe der Wolke: Faellt die alte Antwort weg, wird die Sektion wieder so
 *   hoch wie bei der ersten Frage (Owner 24.11.2026). Bis dahin hielt sie die Hoehe der alten Antwort.
 */

import * as React from 'react'
import type { TeppichPhase } from '..'

/** Ab diesem Versatz (Pixel) wird eingeblendet statt verschoben. */
const WEIT = 40
const EINBLENDEN_MS = 700

export function useTeppichHalt(huelle: React.RefObject<HTMLDivElement | null>, phase: TeppichPhase, platz: number): React.CSSProperties {
  const [oben, setOben] = React.useState(0)
  const [da, setDa] = React.useState(true)
  const stand = React.useRef({ oben: 0, halt: 0, phase })

  React.useLayoutEffect(() => {
    const el = huelle.current
    const ebene = el?.parentElement
    const sektion = el?.closest<HTMLElement>('[data-website-story]')
    if (!el || !ebene || !sektion) return
    const fragt = phase === 'sucht' || phase === 'landet'
    const war = stand.current.phase
    stand.current.phase = phase
    const halte = (px: number) => {
      stand.current.halt = px
      sektion.style.setProperty('--teppich-platz', `${Math.round(px)}px`)
    }
    // Die neue Antwort steht: Der gehaltene Platz der alten darf weichen.
    if (phase === 'antwort' && war !== 'antwort') halte(platz)
    const miss = () => {
      const zone = sektion.querySelector<HTMLElement>('[data-story-karten-modus]')
      // Owner 24.11.2026: Bei einer neuen Frage nimmt die Zone wieder die Hoehe der Wolke an — nicht mehr
      // die der alten Antwort (die Seite war sonst weit nach unten leer). Die Fragebox steht seit R1 oben,
      // dorthin gleitet die Seite; der Bildschirm rutscht dabei nicht mehr weg.
      if (zone) halte(fragt ? platz : Math.max(platz, zone.getBoundingClientRect().height))
      else halte(platz)
      const neu = zone ? Math.round(zone.getBoundingClientRect().top - ebene.getBoundingClientRect().top) : 0
      if (neu === stand.current.oben) return
      if (Math.abs(neu - stand.current.oben) > WEIT) setDa(false)
      stand.current.oben = neu
      sektion.style.setProperty('--teppich-oben', `${neu}px`)
      setOben(neu)
    }
    miss()
    const ro = new ResizeObserver(miss)
    ro.observe(sektion)
    return () => ro.disconnect()
  }, [phase, platz, huelle])

  // Nach einem weiten Wechsel: erst unsichtbar an die neue Stelle, dann einblenden.
  React.useEffect(() => {
    if (da) return
    const id = setTimeout(() => setDa(true), 30)
    return () => clearTimeout(id)
  }, [da])

  return { position: 'relative', top: oben, opacity: da ? 1 : 0, transition: da ? `opacity ${EINBLENDEN_MS}ms ease` : 'none' }
}
