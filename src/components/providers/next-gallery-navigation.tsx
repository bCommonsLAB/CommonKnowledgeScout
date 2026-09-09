'use client'

/**
 * @fileoverview Die Adressierung der Voll-App: Die Galerie steht in der URL.
 *
 * @description
 * Gegenstueck zu `clerk-gallery-viewer-bridge.tsx`. Die Galerie sagt WAS
 * passieren soll, diese Bruecke sagt WIE — hier: ueber `next/navigation`.
 *
 * Jede Methode ist an ihrer frueheren Aufrufstelle abgelesen und traegt die
 * Herkunft im Kommentar. Die Routen-Kenntnis (`/explore/<slug>` gegen
 * `/library/gallery`) wohnt damit an genau einer Stelle — die Galerie selbst
 * weiss nicht mehr, auf welcher Seite sie steht.
 *
 * `tests/unit/components/providers/next-gallery-navigation.test.tsx` haelt
 * das Verhalten je Route fest.
 *
 * @module providers
 */

import { useMemo, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  GalleryNavigationProvider,
  type GalleryNavigation,
} from '@/contexts/gallery-navigation-context'
import { openDocumentBySlug, closeDocument } from '@/utils/document-navigation'

/** Slug aus `/explore/<slug>[/…]`, sonst `null`. */
function exploreSlugOf(pathname: string | null): string | null {
  if (!pathname?.startsWith('/explore/')) return null
  return pathname.match(/\/explore\/([^/]+)/)?.[1] ?? null
}

export function NextGalleryNavigation({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigation = useMemo<GalleryNavigation>(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    const isExplore = pathname?.startsWith('/explore/') === true
    const exploreSlug = exploreSlugOf(pathname)

    return {
      params,

      openDocument: (slug: string) => {
        openDocumentBySlug(slug, router, pathname, searchParams)
      },

      closeDocument: () => {
        closeDocument(router, pathname, searchParams)
      },

      documentShareUrl: (slug: string) => {
        // Auf dem Server gibt es keine Adresse zum Teilen.
        if (typeof window === 'undefined') return ''
        const next = new URLSearchParams(searchParams?.toString() || '')
        if (slug) next.set('doc', slug)
        return `${window.location.origin}${pathname || ''}?${next.toString()}`
      },

      // Abgelesen aus `switch-to-story-mode-button`: auf /explore die
      // Slug-Route, sonst immer /library/gallery — beides ohne Verlaufseintrag
      // und ohne Scrollsprung.
      replaceParams: (next: URLSearchParams) => {
        const qs = next.toString()
        if (isExplore) {
          if (exploreSlug) router.replace(`/explore/${exploreSlug}?${qs}`, { scroll: false })
          return
        }
        router.replace(`/library/gallery?${qs}`, { scroll: false })
      },

      // Abgelesen aus `filter-context-bar`: der aktuelle Pfad, mit
      // Verlaufseintrag; ohne Parameter nur der Pfad.
      pushParams: (next: URLSearchParams) => {
        const qs = next.toString()
        router.push(qs ? `${pathname}?${qs}` : (pathname ?? ''))
      },

      // Abgelesen aus `use-gallery-mode`: auf /explore der aktuelle Pfad ohne
      // Verlaufseintrag, sonst /library/gallery mit Verlaufseintrag.
      applyModeParams: (next: URLSearchParams) => {
        const qs = next.toString()
        const suffix = qs ? `?${qs}` : ''
        if (isExplore) {
          router.replace(`${pathname}${suffix}`)
          return
        }
        router.push(`/library/gallery${suffix}`)
      },
    }
  }, [router, pathname, searchParams])

  return <GalleryNavigationProvider navigation={navigation}>{children}</GalleryNavigationProvider>
}
