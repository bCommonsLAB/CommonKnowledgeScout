'use client'

/**
 * Zwei Fragen, die jede Ueberlagerung der Sektion stellt (Telefon-Vollbild, Graph-Ansicht):
 *
 * 1. **Haelt der Bildschirm sie fest?** `position: fixed` haengt am Bildschirm — ausser ein
 *    Vorfahr spannt selbst den Bezug auf (`transform`, `filter`, `contain` …). In einer fremden
 *    Seite (Embed) kann das jeder Behaelter sein. Dann bliebe die Ueberlagerung in ihm gefangen:
 *    so gross wie er, mit ihm verschoben, der Schliessen-Knopf womoeglich ausser Sicht.
 *    `useBildschirmFest` erkennt das; die Sektion bleibt dann auf ihrer eigenen Flaeche.
 * 2. **Schliesst die Zurueck-Taste sie?** Das Paket fasst die Adresszeile nicht an (Paketgrenze).
 *    Der Gastgeber reicht `zurueckTaste` herein (`WebsiteStoryGastgeber`); ohne sie — im Embed,
 *    das die Chronik der fremden Seite nicht veraendert — schliesst nur der Knopf.
 */

import * as React from 'react'
import type { WebsiteStoryGastgeber } from './website-story-gastgeber'

const FEST_BRECHER = /transform|perspective|filter/

/** Spannt ein Vorfahr von `el` selbst den Bezug fuer `position: fixed` auf? */
export function faengtFestes(el: Element): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (istGesetzt(s.transform) || istGesetzt(s.perspective) || istGesetzt(s.filter) || istGesetzt(s.backdropFilter)) return true
    if (/layout|paint|strict|content/.test(s.contain ?? '')) return true
    if (FEST_BRECHER.test(s.willChange ?? '')) return true
    if (s.containerType !== undefined && s.containerType !== '' && s.containerType !== 'normal') return true
  }
  return false
}

function istGesetzt(wert: string | undefined): boolean {
  return wert !== undefined && wert !== '' && wert !== 'none'
}

/**
 * `true`, solange nichts dagegen spricht: Ueberlagerungen duerfen am Bildschirm haengen. Geprueft
 * wird nach dem Einhaengen und bei jeder Groessenaenderung des Fensters (Behaelter wechseln dort
 * gern ihr Layout).
 */
export function useBildschirmFest(anker: React.RefObject<HTMLElement | null>): boolean {
  const [fest, setFest] = React.useState(true)
  React.useLayoutEffect(() => {
    const pruefe = () => { if (anker.current) setFest(!faengtFestes(anker.current)) }
    pruefe()
    window.addEventListener('resize', pruefe)
    return () => window.removeEventListener('resize', pruefe)
  }, [anker])
  return fest
}

/**
 * Meldet eine offene Ueberlagerung beim Gastgeber an: Die Zurueck-Taste ruft `schliessen`. Schliesst
 * der Leser selbst, nimmt der Gastgeber seinen Schritt zurueck; wird die Sektion ausgehaengt (der
 * Leser ist woanders hingegangen), bleibt die Chronik, wie sie ist.
 */
export function useZurueckTaste(zurueckTaste: WebsiteStoryGastgeber['zurueckTaste'], offen: boolean, schliessen: () => void): void {
  const zu = React.useRef(schliessen)
  zu.current = schliessen
  const istOffen = React.useRef(offen)
  istOffen.current = offen
  React.useEffect(() => {
    if (!offen || !zurueckTaste) return
    const abmelden = zurueckTaste(() => zu.current())
    // Im Aufraeumen: `offen` ist nur dann schon `false`, wenn die Ueberlagerung geschlossen wurde.
    return () => abmelden(!istOffen.current)
  }, [offen, zurueckTaste])
}
