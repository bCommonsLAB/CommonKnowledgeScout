import { headers } from "next/headers"
import { HomeClient } from "@/components/home/home-client"
import { WebsiteLandingLive } from "@/components/library/website/website-landing-live"
import { NextGalleryNavigation } from "@/components/providers/next-gallery-navigation"
import { getRootLandingTargetForHost } from "@/lib/root-landing"

// `/` liest die (gecachte) Root-Library-Config zur Laufzeit — daher dynamisch,
// damit kein Build-Zeit-DB-Zugriff erfolgt. Die DB-Reads selbst sind gecacht
// (getRootLandingTargetForHost, revalidate 60s, pro Host).
export const dynamic = "force-dynamic"

/**
 * Root `/` (E7 + Variante B): Ist fuer den aktuellen Host (Domain→Slug-Map)
 * oder global eine oeffentliche Root-Library konfiguriert, wird deren
 * Landingpage shell-/login-frei gerendert (Shell-Ausblendung entscheidet das
 * RootLayout/AppLayout serverseitig — kein Flash). Sonst Fallback auf die
 * bisherige Library-Uebersicht.
 */
export default async function Home() {
  const hdrs = await headers()
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host")
  const target = await getRootLandingTargetForHost(host)

  if (target) {
    return (
      <main className="min-h-screen">
        {/* Die Landingpage zeigt unter „Mehr aus dieser Bibliothek" Galerie-Karten.
            Seit Adressierung Teil A (#234) verlangen die einen Adressierungs-
            Anbieter — hier, ausserhalb des Galerie-Montagepunkts, gab es keinen,
            und die Karte warf beim Rendern. Die Klick-Semantik bleibt wie vor
            #234: Im Root-Modus fuehrt die Karte ueber ihr eigenes `onClick` in die
            Explore-Galerie; der Anbieter wird nur fuer den Hook gebraucht. */}
        <NextGalleryNavigation>
          <WebsiteLandingLive
            libraryId={target.libraryId}
            fallbackLocale={target.fallbackLocale}
            exploreBaseHref={`/explore/${encodeURIComponent(target.slug)}`}
            librarySlug={target.slug}
          />
        </NextGalleryNavigation>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <HomeClient />
    </main>
  )
}
