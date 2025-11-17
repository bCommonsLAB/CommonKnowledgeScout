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

/**
 * Zentrale Utility-Funktion zum Schließen eines Dokuments (Entfernen des doc-Parameters)
 * 
 * Diese Funktion entfernt den doc-Parameter aus der URL, behält aber alle anderen
 * Parameter bei. Wird verwendet beim Schließen der DetailOverlay oder beim Wechsel
 * zum Story-Mode.
 * 
 * @param router - Next.js Router-Instanz (aus useRouter())
 * @param pathname - Aktueller Pfadname (aus usePathname())
 * @param searchParams - Aktuelle URL-Parameter (aus useSearchParams())
 */
export function closeDocument(
  router: AppRouterInstance,
  pathname: string | null,
  searchParams: URLSearchParams | null
): void {
  console.log('[closeDocument] 🚪 START:', {
    pathname,
    searchParamsString: searchParams?.toString(),
    docParam: searchParams?.get('doc'),
    timestamp: new Date().toISOString(),
  })
  
  try {
    if (pathname?.startsWith('/explore/')) {
      // Explore-Route: Entferne doc-Parameter aus URL
      const librarySlugMatch = pathname.match(/\/explore\/([^/]+)/)
      if (librarySlugMatch && librarySlugMatch[1]) {
        const librarySlug = librarySlugMatch[1]
        const params = new URLSearchParams(searchParams?.toString() || '')
        const hadDoc = params.has('doc')
        params.delete('doc')
        const newUrl = params.toString() ? `/explore/${librarySlug}?${params.toString()}` : `/explore/${librarySlug}`
        console.log('[closeDocument] 🧭 Explore-Route:', {
          librarySlug,
          hadDoc,
          newUrl,
          paramsString: params.toString(),
        })
        router.replace(newUrl, { scroll: false })
      } else {
        console.warn('[closeDocument] ⚠️ Konnte library-slug nicht aus pathname extrahieren:', pathname)
      }
    } else if (pathname?.startsWith('/library')) {
      // Library-Route: Entferne doc-Parameter aus URL
      const params = new URLSearchParams(searchParams?.toString() || '')
      const hadDoc = params.has('doc')
      params.delete('doc')
      const newUrl = params.toString() ? `/library/gallery?${params.toString()}` : '/library/gallery'
      console.log('[closeDocument] 🧭 Library-Route:', {
        hadDoc,
        newUrl,
        paramsString: params.toString(),
      })
      router.replace(newUrl, { scroll: false })
    } else {
      // Fallback: Versuche zur Library-Gallery zu navigieren
      console.warn('[closeDocument] ⚠️ Unbekannte Route, navigiere zur Library-Gallery:', pathname)
      router.replace('/library/gallery', { scroll: false })
    }
    console.log('[closeDocument] ✅ Erfolgreich abgeschlossen')
  } catch (err) {
    console.error('[closeDocument] ❌ Fehler beim Schließen des Dokuments:', err)
  }
}

