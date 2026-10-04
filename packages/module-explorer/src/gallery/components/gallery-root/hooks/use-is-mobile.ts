'use client'

/**
 * src/components/library/gallery/gallery-root/hooks/use-is-mobile.ts
 *
 * Hook zur Erkennung der Mobile-Breakpoints (lg = 1024px).
 *
 * Aus gallery-root.tsx ausgegliedert (Welle 3-III-a, Schritt 2/N).
 *
 * Verhalten 1:1 portiert: Initial false (vor Hydration), nach Mount
 * wird auf window.innerWidth geprueft, dann an resize-Event gebunden.
 */

import { useEffect, useState } from 'react'

/**
 * Schwellwert in Pixeln, ab dem die UI als 'Desktop' gilt.
 * Tailwind-Konvention: `lg`-Breakpoint = 1024px.
 */
const MOBILE_BREAKPOINT_PX = 1024

/**
 * Hook fuer Mobile-Detection per Window-Resize.
 *
 * Returns: `true`, wenn `window.innerWidth < 1024`.
 * Vor Hydration: `false` (Server-Render kennt window nicht).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return isMobile
}

/** Tailwind `md` = 768px: darunter ist es ein Telefon — kein Platz fuer die Quellen-Leiste. */
const TELEFON_BREAKPOINT_PX = 768

/**
 * D12r: `true` unter 768px (Telefon). Dort fuellt die Mitte den Schirm, Quellen
 * und Chronik kommen als Blatt. Zwischen 768 und 1024 (Tablet) steht die
 * Quellen-Leiste rechts wie am Desktop, nur die Chronik bleibt ein Blatt.
 */
export function useIstTelefon(): boolean {
  const [telefon, setTelefon] = useState(false)
  useEffect(() => {
    const check = () => setTelefon(window.innerWidth < TELEFON_BREAKPOINT_PX)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return telefon
}
