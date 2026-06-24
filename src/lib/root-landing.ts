/**
 * Root-Landingpage-Ziel (E7): aufgeloest aus der globalen App-Config
 * (`rootLibrarySlug`) + der oeffentlichen Library. Gecacht (revalidate 60s),
 * damit Layout UND `/`-Page denselben Wert guenstig lesen koennen — verhindert
 * pro-Request-DB-Last und den TopNav-Flash (Server kennt die Entscheidung).
 */

import { unstable_cache } from 'next/cache'
import { getAppConfig } from '@/lib/repositories/app-config-repo'
import { LibraryService } from '@/lib/services/library-service'

export interface RootLandingTarget {
  libraryId: string
  slug: string
  fallbackLocale?: string
}

/**
 * Liefert die unter `/` zu rendernde Landingpage-Library oder `null`
 * (keine konfiguriert / nicht oeffentlich → Fallback auf Library-Uebersicht).
 *
 * Nur zur Laufzeit aufrufen (DB-Zugriff) — nicht im Build-Zweig des RootLayout.
 */
export const getRootLandingTarget = unstable_cache(
  async (): Promise<RootLandingTarget | null> => {
    const { rootLibrarySlug } = await getAppConfig()
    if (!rootLibrarySlug) return null
    const library = await LibraryService.getInstance().getPublicLibraryBySlug(rootLibrarySlug)
    if (!library || library.config?.publicPublishing?.isPublic !== true) return null
    return {
      libraryId: library.id,
      slug: rootLibrarySlug,
      fallbackLocale: library.config?.translations?.fallbackLocale,
    }
  },
  ['root-landing-target-v1'],
  { revalidate: 60 },
)
