'use client'

import { useEffect, useRef } from 'react'
import { useGalleryNavigation } from '../contexts/gallery-navigation-context'
import { nextParamsForMode, readGalleryMode, type GalleryMode } from '../lib/mode-params'

export type { GalleryMode }

/**
 * Welche Ansicht die Galerie zeigt (site | gallery | story) und wie man wechselt.
 *
 * Seit M4f ohne `next/navigation`: Das Vokabular (welche Parameter ein Wechsel
 * setzt und wegraeumt) liegt in `lib/gallery/mode-params.ts`; wohin die
 * Parameter gehen, sagt die Adressierung (`applyModeParams`). Die
 * Hoehenberechnung des Rahmens bleibt hier — sie ist reines DOM.
 *
 * @param defaultMode Ansicht, wenn kein expliziter `view`/`mode`-Query-Parameter
 *   gesetzt ist. Fuer Libraries mit eigener Website (`siteEnabled`) uebergibt die
 *   Explore-Seite `'site'`, damit der Slug direkt die Landingpage zeigt statt der Galerie.
 */
export function useGalleryMode(defaultMode: GalleryMode = 'gallery') {
  const navigation = useGalleryNavigation()
  const mode = readGalleryMode(navigation.params, defaultMode)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateHeight = () => {
      if (!containerRef.current) return

      // D11b (Owner 02.10., „unten bleibt ein Rand"): Die Hoehe wird ab der
      // tatsaechlichen Oberkante des Rahmens gerechnet, nicht aus Navigation
      // plus pauschalem Sicherheitsabstand (115 px) — der liess je nach Kopf
      // bis zu 90 px ungenutzt. Unten bleibt nur der Innenabstand der Seite.
      const oben = containerRef.current.getBoundingClientRect().top
      const seite = containerRef.current.parentElement?.parentElement
      const unten = seite ? parseFloat(getComputedStyle(seite).paddingBottom) || 0 : 0
      const availableHeight = Math.max(240, Math.floor(window.innerHeight - oben - unten))

      containerRef.current.style.height = `${availableHeight}px`
      containerRef.current.style.maxHeight = `${availableHeight}px`
    }

    // Initial nach dem Mount und nach Moduswechsel (site/gallery/story) berechnen
    requestAnimationFrame(() => requestAnimationFrame(updateHeight))

    window.addEventListener('resize', updateHeight)
    return () => {
      window.removeEventListener('resize', updateHeight)
    }
  }, [mode])

  const setMode = (newMode: GalleryMode) => {
    console.log('[useGalleryMode] 🔄 setMode aufgerufen:', {
      newMode,
      currentMode: mode,
      currentSearchParams: navigation.params.toString(),
      docParam: navigation.params.get('doc'),
      timestamp: new Date().toISOString(),
    })

    // Startseite, Inhalte und Story teilen sich dieselbe Gallery-Ansicht.
    // Das Vokabular raeumt die konkurrierenden Parameter weg, damit die
    // Adresse eindeutig bleibt; ob ein Verlaufseintrag entsteht, entscheidet
    // die Adressierung nach Route.
    const next = nextParamsForMode(navigation.params, newMode, defaultMode)
    console.log('[useGalleryMode] 🧭 Ansicht wechseln:', { newMode, paramsNachher: next.toString() })
    navigation.applyModeParams(next)
  }

  return { mode, setMode, containerRef }
}
