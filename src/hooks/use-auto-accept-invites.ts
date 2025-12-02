/**
 * @fileoverview Auto Accept Invites Hook
 * 
 * @description
 * Hook that automatically accepts all pending invitations for the current user
 * after successful login/registration. This handles cases where the invite token
 * was lost during the authentication flow.
 * 
 * @module hooks
 */

"use client"

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

/**
 * Hook that automatically accepts pending invitations after login
 * 
 * This hook:
 * 1. Watches for successful user authentication
 * 2. Calls the API to accept all pending invitations for the user's email
 * 3. Redirects to the first accepted library if any were accepted
 */
export function useAutoAcceptInvites() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const hasCheckedRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Warte bis Clerk geladen ist
    if (!isLoaded) return

    // Wenn kein Benutzer angemeldet ist, reset den Check
    if (!user) {
      hasCheckedRef.current = false
      lastUserIdRef.current = null
      return
    }

    const currentUserId = user.id
    const currentUserEmail = user.emailAddresses?.[0]?.emailAddress

    // Prüfe ob sich der Benutzer geändert hat (neuer Login)
    if (currentUserId === lastUserIdRef.current) {
      // Gleicher Benutzer, bereits geprüft
      return
    }

    // Neuer Benutzer oder neuer Login - akzeptiere ausstehende Einladungen
    if (currentUserEmail && !hasCheckedRef.current) {
      hasCheckedRef.current = true
      lastUserIdRef.current = currentUserId

      // Akzeptiere ausstehende Einladungen im Hintergrund
      fetch('/api/user/accept-pending-invites', {
        method: 'POST',
      })
        .then(async (response) => {
          if (!response.ok) {
            console.warn('[useAutoAcceptInvites] Fehler beim Akzeptieren ausstehender Einladungen:', response.status)
            return
          }

          const data = await response.json()
          
          if (data.acceptedCount > 0 && data.libraries && data.libraries.length > 0) {
            console.log('[useAutoAcceptInvites] Einladungen akzeptiert:', data)
            
            // Wenn wir auf der Home-Seite oder einer generischen Seite sind,
            // leite zur ersten akzeptierten Library weiter
            const currentPath = window.location.pathname
            const isGenericPage = currentPath === '/' || 
                                  currentPath === '/explore' ||
                                  currentPath.startsWith('/sign-in') ||
                                  currentPath.startsWith('/sign-up')
            
            if (isGenericPage && data.libraries[0]?.slug) {
              // Kurze Verzögerung, damit der Benutzer die Erfolgsmeldung sieht
              setTimeout(() => {
                router.push(`/explore/${data.libraries[0].slug}`)
              }, 1000)
            }
          }
        })
        .catch((error) => {
          console.error('[useAutoAcceptInvites] Fehler:', error)
        })
    }
  }, [user, isLoaded, router])
}

