"use client"

/**
 * Wohin Radix-Portale rendern (M5, Embed).
 *
 * Dialoge, Menues, Tooltips und Auswahllisten oeffnen in einem Portal —
 * standardmaessig direkt unter `<body>`. In der Voll-App ist das richtig. Im
 * Embed laeuft die Galerie als Gast in einer fremden Seite, und ihre Stile
 * gelten nur innerhalb des Rahmens `.ks-embed` (Owner-Entscheidung
 * 2026-09-10). Ein Portal unter `<body>` stuende ausserhalb: ohne Stile, ohne
 * Farb-Variablen. Die Huelle reicht deshalb ihren Rahmen als Ziel herein.
 *
 * Ohne Anbieter liefert `usePortalContainer()` `undefined`, und Radix rendert
 * wie bisher unter `<body>`. Das ist kein stiller Rueckfall, sondern der
 * Normalfall der Voll-App: Sie setzt keinen Anbieter, und genau das bedeutet
 * `<body>`.
 */

import * as React from "react"

const PortalContainerContext = React.createContext<HTMLElement | null>(null)

export function PortalContainerProvider({
  container,
  children,
}: {
  /** Das Element, in das Portale rendern; `null`, solange es noch nicht montiert ist. */
  container: HTMLElement | null
  children: React.ReactNode
}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
}

/** Das Ziel fuer Radix-Portale; `undefined` heisst `<body>` (Radix-Standard). */
export function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalContainerContext) ?? undefined
}
