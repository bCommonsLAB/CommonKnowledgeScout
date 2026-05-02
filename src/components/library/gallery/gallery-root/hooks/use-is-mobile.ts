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
