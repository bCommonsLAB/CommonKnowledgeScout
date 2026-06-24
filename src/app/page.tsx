import { HomeClient } from "@/components/home/home-client"
import { WebsiteLandingLive } from "@/components/library/website/website-landing-live"
import { getRootLandingTarget } from "@/lib/root-landing"

// `/` liest die (gecachte) Root-Library-Config zur Laufzeit — daher dynamisch,
// damit kein Build-Zeit-DB-Zugriff erfolgt. Die DB-Reads selbst sind gecacht
// (getRootLandingTarget, revalidate 60s).
export const dynamic = "force-dynamic"

/**
 * Root `/` (E7): Ist eine Root-Library konfiguriert und oeffentlich, wird deren
 * Landingpage shell-/login-frei gerendert (Shell-Ausblendung entscheidet das
 * RootLayout/AppLayout serverseitig — kein Flash). Sonst Fallback auf die
 * bisherige Library-Uebersicht.
 */
export default async function Home() {
  const target = await getRootLandingTarget()

  if (target) {
    return (
      <main className="min-h-screen">
        <WebsiteLandingLive
          libraryId={target.libraryId}
          fallbackLocale={target.fallbackLocale}
          exploreBaseHref={`/explore/${encodeURIComponent(target.slug)}`}
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <HomeClient />
    </main>
  )
}
