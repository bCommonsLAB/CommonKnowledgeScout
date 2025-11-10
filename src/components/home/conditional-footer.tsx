'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

/**
 * Footer-Komponente, die nur auf bestimmten Seiten angezeigt wird.
 * 
 * Wird NICHT angezeigt auf:
 * - /library/gallery/* (Gallery und Story-Modus)
 * - /explore/* (Explore-Seiten mit Gallery-Komponente)
 * 
 * Wird angezeigt auf:
 * - Homepage (/)
 * - Alle anderen Seiten (About, Datenschutz, etc.)
 */
export function ConditionalFooter() {
  const pathname = usePathname()
  
  // Footer nicht anzeigen im Gallery/Story-Modus
  // Prüfe sowohl /library/gallery als auch /explore/* (beide verwenden die Gallery-Komponente)
  const isGalleryOrStoryMode = pathname?.startsWith('/library/gallery') || pathname?.startsWith('/explore/')
  
  if (isGalleryOrStoryMode) {
    return null
  }
  
  return <Footer />
}



