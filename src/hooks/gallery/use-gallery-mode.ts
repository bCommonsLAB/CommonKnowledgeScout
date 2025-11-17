'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function useGalleryMode() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const modeParam = searchParams?.get('mode')
  const mode = (modeParam === 'story' ? 'story' : 'gallery') as 'gallery' | 'story'

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

    // Initial nach dem Mount und nach Moduswechsel (gallery/story) berechnen
    requestAnimationFrame(() => requestAnimationFrame(updateHeight))

    window.addEventListener('resize', updateHeight)
    return () => {
      window.removeEventListener('resize', updateHeight)
    }
  }, [mode])

  const setMode = (newMode: 'gallery' | 'story') => {
    console.log('[useGalleryMode] 🔄 setMode aufgerufen:', {
      newMode,
      currentMode: mode,
      pathname,
      currentSearchParams: searchParams?.toString(),
      docParam: searchParams?.get('doc'),
      timestamp: new Date().toISOString(),
    })
    
    const params = new URLSearchParams(searchParams?.toString() || '')
    
    // WICHTIG: Entferne doc Parameter beim Wechsel zum Story-Mode
    // Der doc Parameter sollte nicht im Story-Mode vorhanden sein
    if (newMode === 'story') {
      const hadDoc = params.has('doc')
      params.delete('doc')
      params.set('mode', 'story')
      console.log('[useGalleryMode] ✅ Story-Mode: doc Parameter entfernt:', {
        hatteDoc: hadDoc,
        docWertVorher: searchParams?.get('doc'),
        paramsNachher: params.toString(),
      })
    } else {
      params.delete('mode')
      console.log('[useGalleryMode] ✅ Gallery-Mode gesetzt')
    }
    
    const isExplore = pathname?.startsWith('/explore/')
    const newUrl = isExplore
      ? `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
      : `/library/gallery${params.toString() ? `?${params.toString()}` : ''}`
    
    console.log('[useGalleryMode] 🧭 Navigiere zu:', {
      newUrl,
      paramsString: params.toString(),
      isExplore,
    })
    
    if (isExplore) {
      router.replace(newUrl)
    } else {
      router.push(newUrl)
    }
  }

  return { mode, setMode, containerRef }
}












