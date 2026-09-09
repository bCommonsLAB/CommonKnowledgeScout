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

      const navHeight = document.querySelector('nav')?.offsetHeight || 0

      // Prüfe die Tailwind Media Queries direkt aus CSS
      // md: 768px, lg: 1024px
      // Mobile: < 768px, Tablet: 768px - 1023px, Desktop: ≥ 1024px
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches
      const isTablet = window.matchMedia('(min-width: 640px) and (max-width: 1023px)').matches

      const safetyMargin = isDesktop ? 115 : isTablet ? 115 : 70
      const availableHeight = window.innerHeight - navHeight - safetyMargin

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
