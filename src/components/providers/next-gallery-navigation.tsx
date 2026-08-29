'use client'

/**
 * @fileoverview Die Adressierung der Voll-App: Dokumente stehen in der URL.
 *
 * @description
 * Gegenstueck zu `clerk-gallery-viewer-bridge.tsx`. Die Galerie sagt WAS
 * passieren soll, diese Bruecke sagt WIE — hier: ueber `next/navigation` und
 * den `?doc=`-Parameter, genau wie bisher.
 *
 * Das Verhalten ist unveraendert; die Routen-Logik liegt weiterhin in
 * `utils/document-navigation.ts` (samt ihrer zwei fest verdrahteten
 * Routen-Formen — das ist Teil B der Adressierungs-Welle und noch offen).
 *
 * Fuers Embed wird es spaeter eine zweite Umsetzung geben, die die Adresse der
 * Wirtsseite NICHT anfasst (Owner-Entscheidung 2026-08-29).
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

export function NextGalleryNavigation({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigation = useMemo<GalleryNavigation>(
    () => ({
      openDocument: (slug: string) => {
        openDocumentBySlug(slug, router, pathname, searchParams)
      },
      closeDocument: () => {
        closeDocument(router, pathname, searchParams)
      },
      documentShareUrl: (slug: string) => {
        // Auf dem Server gibt es keine Adresse zum Teilen.
        if (typeof window === 'undefined') return ''
        const params = new URLSearchParams(searchParams?.toString() || '')
        if (slug) params.set('doc', slug)
        return `${window.location.origin}${pathname || ''}?${params.toString()}`
      },
    }),
    [router, pathname, searchParams]
  )

  return <GalleryNavigationProvider navigation={navigation}>{children}</GalleryNavigationProvider>
}
