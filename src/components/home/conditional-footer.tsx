'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

interface ConditionalFooterProps {
  /**
   * Slug der host-basierten Root-Landingpage (Variante B), vom RootLayout
   * ueber `getRootLandingTargetForHost` ermittelt — dieselbe Entscheidung,
   * mit der `AppLayout` die Shell auf `/` ausblendet. Gesetzt = die Domain-Root
   * rendert eine Website-Landingpage und der KnowledgeScout-Footer entfaellt
   * (die Website bringt ihre eigene Fusszeile mit, Phase C1).
   */
  rootLandingSlug?: string | null
}

/**
 * Footer-Komponente, die nur auf bestimmten Seiten angezeigt wird.
 *
 * Wird NICHT angezeigt auf:
 * - /library/gallery/* (Gallery und Story-Modus)
 * - /explore/* (Explore-Seiten mit Gallery-Komponente)
 * - `/` auf einem Host mit Root-Landingpage (rootLandingSlug gesetzt)
 *
 * Wird angezeigt auf:
 * - Homepage (/) ohne Root-Landingpage
 * - Alle anderen Seiten (About, Datenschutz, etc.)
 */
export function ConditionalFooter({ rootLandingSlug = null }: ConditionalFooterProps) {
  const pathname = usePathname()

  // Footer nicht anzeigen im Gallery/Story-Modus
  // Prüfe sowohl /library/gallery als auch /explore/* (beide verwenden die Gallery-Komponente)
  const isGalleryOrStoryMode = pathname?.startsWith('/library/gallery') || pathname?.startsWith('/explore/')

  // Host-gemappte Domain-Root (z.B. oldiesforfuture.org): shell-freie Website-
  // Landingpage — gleiche Entscheidung wie `hideAppChrome` im AppLayout.
  const isRootLandingPage = pathname === '/' && Boolean(rootLandingSlug)

  if (isGalleryOrStoryMode || isRootLandingPage) {
    return null
  }

  return <Footer />
}
