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
    if (mode !== 'story') {
      if (containerRef.current) {
        containerRef.current.style.height = ''
        containerRef.current.style.maxHeight = ''
      }
      return
    }
    const updateHeight = () => {
      if (!containerRef.current) return
      const navHeight = document.querySelector('nav')?.offsetHeight || 0
      const availableHeight = window.innerHeight - navHeight
      containerRef.current.style.height = `${availableHeight}px`
      containerRef.current.style.maxHeight = `${availableHeight}px`
    }
    requestAnimationFrame(() => requestAnimationFrame(updateHeight))
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
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




