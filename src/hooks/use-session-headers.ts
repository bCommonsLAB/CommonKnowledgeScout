/**
 * Hook für Session-ID Header bei anonymen Nutzern
 * 
 * Generiert Header-Objekt mit Session-ID für API-Aufrufe von anonymen Nutzern.
 * Wird sowohl im Chat als auch in der Gallery verwendet.
 */

import { useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { getOrCreateSessionId } from '@/lib/session/session-utils'

/**
 * Hook, der Session-ID Header für anonyme Nutzer zurückgibt
 * 
 * @returns Header-Objekt mit X-Session-ID, falls Nutzer anonym ist, sonst leeres Objekt
 */
export function useSessionHeaders(): Record<string, string> {
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn

  return useMemo((): Record<string, string> => {
    if (!isAnonymous) {
      return {}
    }

    try {
      const sessionId = getOrCreateSessionId()
      // Nur Header setzen, wenn Session-ID nicht temporär ist
      if (!sessionId.startsWith('temp-')) {
        return { 'X-Session-ID': sessionId }
      }
    } catch {
      // Bei Fehler: Keine Header
    }

    return {}
  }, [isAnonymous])
}

