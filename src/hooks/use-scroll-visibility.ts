'use client'

import { useEffect, useState, useRef } from 'react'

/**
 * Hook für vereinheitlichte Scroll-Sichtbarkeits-Logik
 * 
 * Verwendet von TopNav, GalleryStickyHeader und StoryModeHeader, um doppelte Event-Listener zu vermeiden.
 * 
 * Verhalten:
 * - Blendet aus beim Scrollen nach unten
 * - Blendet nur ein, wenn ganz oben (scrollY === 0)
 * - Reagiert NUR auf window scroll (äußerste Ebene), nicht auf untergeordnete scrollbare Container
 * 
 * Wichtig: Nur window scroll wird berücksichtigt, damit das Menü/Header nicht durch Scrollen
 * in untergeordneten Containern (z.B. Galerie-Liste) beeinflusst wird.
 */
export function useScrollVisibility() {
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    // Initial: Prüfe ob Seite bereits gescrollt ist (nur window scroll)
    const getInitialScrollY = (): number => {
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const initialScrollY = getInitialScrollY()
    setIsVisible(initialScrollY === 0)
    lastScrollY.current = initialScrollY

    const handleScroll = () => {
      // Nur window scroll berücksichtigen
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0
      
      // Nur wenn wir ganz oben sind (scrollY === 0), einblenden
      if (scrollY === 0) {
        setIsVisible(true)
        lastScrollY.current = scrollY
        return
      }
      
      // Beim Scrollen nach unten ausblenden
      // Wird nur wieder eingeblendet, wenn scrollY === 0 (siehe oben)
      if (scrollY > lastScrollY.current + 5) {
        setIsVisible(false)
      }
      
      lastScrollY.current = scrollY
    }

    // Nur window scroll listener hinzufügen
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return isVisible
}

