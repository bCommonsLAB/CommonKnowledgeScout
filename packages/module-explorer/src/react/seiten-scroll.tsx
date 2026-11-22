'use client'

/**
 * Die Webseite einer Library scrollt mit dem Fenster (Owner 22.11.2026: nur ein Scrollbalken).
 *
 * `/explore/<slug>` ist sonst eine App-Seite mit fester Hoehe: Die Galerie scrollt ihre Listen
 * selbst, und die Webseite bekam deshalb einen eigenen Scroll-Kasten — dazu kam der Balken des
 * Fensters. Steht die Webseiten-Ansicht offen, meldet die Galerie-Wurzel das hier; der Explorer
 * gibt dann die feste Hoehe frei, Kopf, Hinweis und Webseite scrollen zusammen mit dem Fenster.
 *
 * Bewusst ein React-Kontext, kein Atom: Die Galerie kann einen eigenen Jotai-Speicher haben.
 * Ohne Anbieter (Galerie unter `/library/gallery`) aendert sich nichts.
 */

import * as React from 'react'

const SeitenScrollKontext = React.createContext<((fenster: boolean) => void) | null>(null)

export const SeitenScrollAnbieter = SeitenScrollKontext.Provider

/**
 * Meldet, ob die Webseiten-Ansicht offen ist. Gibt zurueck, ob sie mit dem Fenster scrollt —
 * nur dann, wenn ein Anbieter da ist (Explorer) und die Ansicht offen ist.
 */
export function useSeitenScrollMelden(offen: boolean): boolean {
  const melde = React.useContext(SeitenScrollKontext)
  React.useEffect(() => {
    if (!melde) return
    melde(offen)
    return () => melde(false)
  }, [melde, offen])
  return melde !== null && offen
}
