/**
 * Root-Landingpage-Ziel (E7): aufgeloest aus der globalen App-Config
 * (`rootLibrarySlug`) ODER — pro Domain — aus der Domain→Slug-Zuordnung
 * (`PUBLIC_DOMAIN_LIBRARY_MAP`, Variante B). Gecacht (revalidate 60s), damit
 * Layout UND `/`-Page denselben Wert guenstig lesen — verhindert pro-Request-
 * DB-Last und den TopNav-Flash (Server kennt die Entscheidung).
 *
 * Variante B (host-basiert): Eine zweite Domain (z.B. `oldiesforfuture.org`)
 * zeigt shell-frei die Landingpage IHRER Library, OHNE die globale
 * KnowledgeScout-Startseite (`knowledgescout.org`) zu veraendern.
 */

import { unstable_cache } from 'next/cache'
import { getAppConfig } from '@/lib/repositories/app-config-repo'
import { LibraryService } from '@/lib/services/library-service'
import { getDomainLibraryMap, normalizeHost } from '@/lib/domain-library-map'

// Re-Export fuer Bestandsnutzer (Host-Normalisierung lebt jetzt edge-tauglich
// in domain-library-map.ts, damit auch die Middleware sie nutzen kann).
export { normalizeHost }

export interface RootLandingTarget {
  libraryId: string
  slug: string
  fallbackLocale?: string
}

/** Loest einen Slug zur oeffentlichen Library auf (nur wenn wirklich public). */
async function resolveTargetBySlug(slug: string): Promise<RootLandingTarget | null> {
  const library = await LibraryService.getInstance().getPublicLibraryBySlug(slug)
  if (!library || library.config?.publicPublishing?.isPublic !== true) return null
  return {
    libraryId: library.id,
    slug,
    fallbackLocale: library.config?.translations?.fallbackLocale,
  }
}

/**
 * Liefert die unter `/` zu rendernde Landingpage-Library oder `null`
 * (keine konfiguriert / nicht oeffentlich → Fallback auf Library-Uebersicht).
 *
 * Reihenfolge:
 *  1. Domain→Slug-Map (`PUBLIC_DOMAIN_LIBRARY_MAP`) fuer den aktuellen Host.
 *  2. Globale `rootLibrarySlug`-Config (unveraendertes knowledgescout.org-Verhalten).
 *
 * `host` MUSS uebergeben werden (aus `headers()`), damit die Entscheidung pro
 * Domain gecacht werden kann. Nur zur Laufzeit aufrufen (DB-Zugriff).
 */
export const getRootLandingTargetForHost = unstable_cache(
  async (host: string | null): Promise<RootLandingTarget | null> => {
    const normalized = host ? normalizeHost(host) : ''
    if (normalized) {
      const slug = getDomainLibraryMap()[normalized]
      if (slug) {
        const target = await resolveTargetBySlug(slug)
        if (target) return target
        // Domain ist gemappt, aber die Library ist nicht (mehr) oeffentlich/auffindbar.
        console.error(
          `[root-landing] Domain "${normalized}" ist auf Slug "${slug}" gemappt, aber es wurde keine oeffentliche Library gefunden.`,
        )
      }
    }
    // Fallback: globale Root-Library (knowledgescout.org-Verhalten).
    const { rootLibrarySlug } = await getAppConfig()
    if (!rootLibrarySlug) return null
    return resolveTargetBySlug(rootLibrarySlug)
  },
  ['root-landing-target-for-host-v1'],
  { revalidate: 60 },
)
