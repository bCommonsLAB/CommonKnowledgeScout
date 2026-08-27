/**
 * Root-Landingpage-Ziel (E7): aufgeloest ueber den Host→SiteConfig-Resolver
 * der Schale (`@ks/shell`, Welle M3). Der Host bestimmt die Site; deren
 * Primaer-Library ist das Landingpage-Ziel. Ist keine Site fuer den Host
 * hinterlegt, greift die Default-Site (Voll-App, `mode: 'user-selected'`) —
 * dort entscheidet weiterhin die globale App-Config (`rootLibrarySlug`).
 *
 * Gecacht (revalidate 60s), damit Layout UND `/`-Page denselben Wert guenstig
 * lesen — verhindert pro-Request-DB-Last und den TopNav-Flash (Server kennt
 * die Entscheidung).
 *
 * Variante B (host-basiert): Eine zweite Domain (z.B. `oldiesforfuture.org`)
 * zeigt shell-frei die Landingpage IHRER Library, OHNE die globale
 * KnowledgeScout-Startseite (`knowledgescout.org`) zu veraendern.
 */

import { unstable_cache } from 'next/cache'
import { getAppConfig } from '@/lib/repositories/app-config-repo'
import { LibraryService } from '@/lib/services/library-service'
import { normalizeHost, resolveSiteConfigForHost } from '@ks/shell'
import { isSitePrimaryBySlug } from '@ks/contracts'

// Re-Export fuer Bestandsnutzer (Host-Normalisierung lebt jetzt in
// `@ks/shell` — edge-tauglich, damit auch die Middleware sie nutzen kann).
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
 * Reihenfolge (unveraendert gegenueber der Domain→Slug-Map, nur ueber die
 * Site-Registry ausgedrueckt):
 *  1. Site des Hosts mit fest gebundener Primaer-Library (`{ slug }`).
 *  2. Default-Site (`mode: 'user-selected'`) → globale `rootLibrarySlug`-Config.
 *
 * `host` MUSS uebergeben werden (aus `headers()`), damit die Entscheidung pro
 * Domain gecacht werden kann. Nur zur Laufzeit aufrufen (DB-Zugriff).
 */
export const getRootLandingTargetForHost = unstable_cache(
  async (host: string | null): Promise<RootLandingTarget | null> => {
    const site = resolveSiteConfigForHost(host)
    const primary = site.libraries.primary
    if (isSitePrimaryBySlug(primary)) {
      const target = await resolveTargetBySlug(primary.slug)
      if (target) return target
      // Site ist an eine Library gebunden, aber die ist nicht (mehr)
      // oeffentlich/auffindbar. Laut melden statt still weiterzufallen.
      console.error(
        `[root-landing] Site "${site.id}" ist auf Slug "${primary.slug}" gebunden, aber es wurde keine oeffentliche Library gefunden.`,
      )
    }
    // Default-Site: globale Root-Library (knowledgescout.org-Verhalten).
    const { rootLibrarySlug } = await getAppConfig()
    if (!rootLibrarySlug) return null
    return resolveTargetBySlug(rootLibrarySlug)
  },
  ['root-landing-target-for-host-v1'],
  { revalidate: 60 },
)
