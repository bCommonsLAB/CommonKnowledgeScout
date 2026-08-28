'use client'

import { Suspense, useLayoutEffect, useState } from "react"
import { HeroSection } from "@/components/home/hero-section"
import { LibraryGrid } from "@/components/home/library-grid"
import { HowItWorks } from "@/components/home/how-it-works"
import { PhilosophySection } from "@/components/home/philosophy-section"
import { CTASection } from "@/components/home/cta-section"
import { useApplyLocale } from "@ks/i18n/react"
import { getLocale, type Locale } from "@ks/i18n"

/**
 * Client-only Home Wrapper
 * 
 * Einfache Lösung: Warte mit dem Rendern, bis die Locale bestimmt ist
 * (URL > Cookie > Browser). Dadurch gibt es kein Flackern und kein
 * Hydration-Mismatch auf der Homepage.
 */
export function HomeClient() {
  const setLocale = useApplyLocale()
  const [ready, setReady] = useState(false)

  // Locale synchron vor dem ersten Paint bestimmen und setzen
  useLayoutEffect(() => {
    // URL-Param lang
    const urlParams = new URLSearchParams(window.location.search)
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    
    const newLocale = getLocale(urlParams.toString(), cookieValue, navigator.language) as Locale
    setLocale(newLocale)
    setReady(true)
  }, [setLocale])

  if (!ready) {
    // Optional: dünner Platzhalter, um Layout-Shift zu vermeiden
    return <div className="min-h-screen" />
  }

  return (
    <Suspense fallback={null}>
      <HeroSection />
      <LibraryGrid />
      <HowItWorks />
      <PhilosophySection />
      <CTASection />
    </Suspense>
  )
}


