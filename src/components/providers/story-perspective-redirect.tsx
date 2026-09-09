'use client'

/**
 * @fileoverview Story-Modus ohne Perspektive: die App springt zur Perspektiven-Wahl.
 *
 * @description
 * Bis M4h lag das als Effekt in `gallery-root` und las dafuer
 * `storyCharacterAtom` — Story-Zustand, der der Galerie nicht gehoert und sie
 * ueber `lib/chat/constants` an 817 Zeilen Chat-Vokabular band. Die Regel ist
 * App-Politik: Wer den Story-Modus ohne (oder nur mit der Default-)
 * Perspektive betritt, wird einmal zur Wahl geschickt; ein Flag im
 * localStorage merkt sich, dass das schon passiert ist.
 *
 * Abgelesen, nicht ausgedacht — Bedingung und Ziele sind die aus
 * `gallery-root` vor M4h: auf `/explore/<slug>` die Perspektiven-Seite des
 * Slugs, auf `/library/gallery` die Perspektiven-Seite mit `libraryId` und
 * Herkunft, nie von der Perspektiven-Seite selbst aus (sonst Schleife).
 *
 * Sitzt in `GalleryAppProviders`, also an jedem Montagepunkt der Galerie —
 * auf der Root-Landingpage und im Teaser laeuft er leer, weil dort keine der
 * beiden Routen gilt.
 *
 * @module providers
 */

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useActiveLibraryId } from '@ks/shell/react'
import { storyCharacterAtom } from '@/atoms/story-context-atom'
import { readGalleryMode } from '@/lib/gallery/mode-params'

/** localStorage-Schluessel: Perspektive wurde einmal gewaehlt, nicht mehr nachfragen. */
export const STORY_PERSPECTIVE_SET_FLAG = 'story-perspective-set'

export function StoryPerspectiveRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const character = useAtomValue(storyCharacterAtom)
  const libraryId = useActiveLibraryId()

  useEffect(() => {
    // `story` gilt unabhaengig vom Default der Ansicht: nur `?mode=story`
    // ohne `view=` fuehrt dorthin (siehe `readGalleryMode`).
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (readGalleryMode(params, 'gallery') !== 'story') return

    const hasPerspective = character.length > 0
    const isDefaultPerspective = character.length === 1 && character[0] === 'business'
    const perspectiveSetFlag = typeof window !== 'undefined' ? localStorage.getItem(STORY_PERSPECTIVE_SET_FLAG) : null
    if (!((!hasPerspective || isDefaultPerspective) && !perspectiveSetFlag)) return

    if (!pathname || pathname.includes('/perspective')) return
    if (pathname.startsWith('/explore/')) {
      const slug = pathname.match(/\/explore\/([^/]+)/)?.[1]
      if (slug) router.push(`/explore/${slug}/perspective`)
      return
    }
    if (pathname.startsWith('/library/gallery') && libraryId) {
      const next = new URLSearchParams(searchParams?.toString() || '')
      next.set('libraryId', libraryId)
      next.set('from', 'story')
      router.push(`/library/gallery/perspective?${next.toString()}`)
    }
  }, [character, libraryId, pathname, router, searchParams])

  return null
}
