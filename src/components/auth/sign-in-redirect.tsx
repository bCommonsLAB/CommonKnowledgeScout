/**
 * @fileoverview Sign-In Redirect Handler
 * 
 * @description
 * Client component that handles redirect after sign-in by reading the redirect URL
 * from session storage and navigating to it.
 * 
 * @module components/auth
 */

"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"

/**
 * Sign-In Redirect Handler Component
 * 
 * Reads the redirect URL from session storage after sign-in and navigates to it.
 */
export function SignInRedirectHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoaded } = useUser()

  useEffect(() => {
    // Nur ausführen, wenn Clerk geladen ist und Benutzer eingeloggt ist
    if (!isLoaded) return

    // Nur auf der Sign-In-Seite ausführen
    if (pathname !== '/sign-in') return

    // Wenn Benutzer eingeloggt ist, prüfe Session Storage für Redirect-URL
    if (user) {
      const redirectUrl = typeof window !== 'undefined' 
        ? sessionStorage.getItem('signInRedirect') 
        : null

      if (redirectUrl) {
        // Entferne Redirect-URL aus Session Storage
        sessionStorage.removeItem('signInRedirect')
        // Navigiere zur gespeicherten Redirect-URL
        router.push(redirectUrl)
      }
    }
  }, [user, isLoaded, pathname, router])

  return null
}

