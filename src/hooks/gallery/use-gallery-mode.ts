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
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (newMode === 'story') params.set('mode', 'story')
    else params.delete('mode')
    const isExplore = pathname?.startsWith('/explore/')
    if (isExplore) router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`)
    else router.push(`/library/gallery${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return { mode, setMode, containerRef }
}












