'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Zentrale Utility-Funktion zum Öffnen eines Dokuments über URL-Parameter
 * 
 * Diese Funktion stellt sicher, dass alle Dokument-Klicks die URL setzen,
 * sodass die DetailOverlay-Verwaltung zentral über URL-Parameter erfolgen kann.
 * 
 * @param slug - Der Slug des Dokuments (aus doc.slug)
 * @param libraryId - Die ID der Library
 * @param router - Next.js Router-Instanz (aus useRouter())
 * @param pathname - Aktueller Pfadname (aus usePathname())
 * @param searchParams - Aktuelle URL-Parameter (aus useSearchParams())
 */
export function openDocumentBySlug(
  slug: string,
  libraryId: string,
  router: AppRouterInstance,
  pathname: string | null,
  searchParams: URLSearchParams | null
): void {
  if (!slug) {
    console.warn('[openDocumentBySlug] Kein Slug angegeben')
    return
  }

  try {
    // Prüfe aktuelle Route
    if (pathname?.startsWith('/explore/')) {
      // Explore-Route: Setze doc-Parameter in URL
      const librarySlugMatch = pathname.match(/\/explore\/([^/]+)/)
      if (librarySlugMatch && librarySlugMatch[1]) {
        const librarySlug = librarySlugMatch[1]
        const params = new URLSearchParams(searchParams?.toString() || '')
        params.set('doc', slug)
        router.replace(`/explore/${librarySlug}?${params.toString()}`, { scroll: false })
      } else {
        console.warn('[openDocumentBySlug] Konnte library-slug nicht aus pathname extrahieren:', pathname)
      }
    } else if (pathname?.startsWith('/library')) {
      // Library-Route: Navigiere zur Gallery-Route mit doc-Parameter
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.set('doc', slug)
      // Prüfe ob bereits auf Gallery-Route
      if (pathname === '/library/gallery' || pathname.startsWith('/library/gallery')) {
        router.replace(`/library/gallery?${params.toString()}`, { scroll: false })
      } else {
        // Navigiere zur Gallery-Route
        router.push(`/library/gallery?${params.toString()}`, { scroll: false })
      }
    } else {
      // Fallback: Versuche zur Library-Gallery zu navigieren
      console.warn('[openDocumentBySlug] Unbekannte Route, navigiere zur Library-Gallery:', pathname)
      const params = new URLSearchParams()
      params.set('doc', slug)
      router.push(`/library/gallery?${params.toString()}`, { scroll: false })
    }
  } catch (err) {
    console.error('[openDocumentBySlug] Fehler beim Öffnen des Dokuments:', err)
  }
}

