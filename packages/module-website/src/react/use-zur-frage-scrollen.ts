'use client'

/**
 * Zur Frage scrollen (Owner 23.11.2026: „wenn was zum Scrollen ist, dann wird es langsam dorthin
 * scrollen. Einmal, fertig."). Wer eine Frage absendet — auch eine Folgefrage unten in der
 * Eingabe —, soll die Zone sehen, in der Frage, Wolke und spaeter die Antwort stehen.
 *
 * - Steht die Zone schon ganz im Bild, scrollt nichts.
 * - Sonst gleitet die Seite EINMAL an ihren Anfang: die Fragebox (R1, 24.11.2026 — sie zeigt die
 *   gestellte Frage und steht direkt ueber der Zone der Antwort).
 * - Verschiebt sich das Ziel, waehrend die Seite noch gleitet (gemessen: 64 px, wenn ueber der
 *   Antwort die Kopfzeile wegfaellt), wird dieselbe Bewegung umgelenkt statt daneben zu landen.
 * - Scrollt der Mensch selbst, hat er Vorrang.
 */

import * as React from 'react'
import type { TeppichPhase } from '..'
import { sichtHoehe } from './use-teppich-flaeche'

/** So lange nach dem Absenden folgt das Scrollen einem verschobenen Ziel. */
const NACHFUEHREN_MS = 3000
/** Luft ueber der Fragebox. */
const LUFT = 24

/** Der Behaelter, der die Seite scrollt (Site-Modus der App), sonst das Dokument. */
function scrollBehaelter(el: HTMLElement): Element {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  const doc = document.scrollingElement
  if (!doc) throw new Error('[WebsiteTeppich] Kein scrollendes Element im Dokument')
  return doc
}

/** Lage des Ziels im scrollenden Inhalt (unabhaengig davon, wie weit gerade gescrollt ist). */
function lageIm(behaelter: Element, ziel: Element): number {
  const oben = behaelter === document.scrollingElement ? 0 : behaelter.getBoundingClientRect().top
  return ziel.getBoundingClientRect().top - oben + behaelter.scrollTop
}

export function useZurFrageScrollen(huelle: React.RefObject<HTMLElement | null>, phase: TeppichPhase, bewegung: boolean): void {
  const vorher = React.useRef(phase)
  React.useEffect(() => {
    const war = vorher.current
    vorher.current = phase
    if (phase !== 'sucht' || war === 'sucht') return
    const el = huelle.current
    // Telefon-Vollbild (R3): die Sektion liegt fest ueber dem Bildschirm, die Fragebox steht oben — nichts zu scrollen.
    if (el?.closest('[data-story-vollbild]')) return
    const ziel = el?.closest('[data-website-story]')?.querySelector<HTMLElement>('[data-story-karten-modus]')
    const box = el?.closest('[data-website-story]')?.querySelector<HTMLElement>('[data-story-eingabe-inline]')
    if (!el || !ziel || !box) {
      console.warn('[WebsiteTeppich] Fragebox oder Zone der Antwort nicht gefunden, kein Scrollen zur Frage')
      return
    }
    // Die Fragebox und die Zone (Wolke samt Botschaft) stehen schon ganz im Bild: nichts scrollt.
    const behaelter = scrollBehaelter(el)
    const bildOben = behaelter === document.scrollingElement ? 0 : behaelter.getBoundingClientRect().top
    const oben = ziel.getBoundingClientRect().top - bildOben
    if (box.getBoundingClientRect().top - bildOben >= 0 && oben + el.getBoundingClientRect().height <= sichtHoehe(el)) return
    const art: ScrollBehavior = bewegung ? 'smooth' : 'auto'
    const hin = () => behaelter.scrollTo({ top: Math.max(0, lageIm(behaelter, box) - LUFT), behavior: art })
    hin()
    let lage = lageIm(behaelter, box)
    const bis = performance.now() + NACHFUEHREN_MS
    let bild = 0
    const folge = () => {
      const jetzt = lageIm(behaelter, box)
      if (Math.abs(jetzt - lage) > 2) {
        lage = jetzt
        hin()
      }
      if (performance.now() < bis) bild = requestAnimationFrame(folge)
    }
    bild = requestAnimationFrame(folge)
    const halt = () => { cancelAnimationFrame(bild) }
    window.addEventListener('wheel', halt, { passive: true, once: true })
    window.addEventListener('touchstart', halt, { passive: true, once: true })
    return () => { cancelAnimationFrame(bild); window.removeEventListener('wheel', halt); window.removeEventListener('touchstart', halt) }
  }, [phase, huelle, bewegung])
}
