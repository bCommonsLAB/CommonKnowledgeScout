'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

/**
 * Footer-Komponente, die nur auf bestimmten Seiten angezeigt wird.
 * 
 * Wird NICHT angezeigt auf:
 * - /library/gallery/* (Gallery und Story-Modus)
 * 
 * Wird angezeigt auf:
 * - Homepage (/)
 * - Explore-Seiten (/explore/*)
 * - Alle anderen Seiten (About, Datenschutz, etc.)
 */
export function ConditionalFooter() {
  const pathname = usePathname()
  
  // Footer nicht anzeigen im Gallery/Story-Modus
  const isGalleryOrStoryMode = pathname?.startsWith('/library/gallery')
  
  if (isGalleryOrStoryMode) {
    return null
  }
  
  return <Footer />
}



