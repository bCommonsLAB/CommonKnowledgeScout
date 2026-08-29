/**
 * Hook für Session-ID Header bei anonymen Nutzern
 *
 * Generiert Header-Objekt mit Session-ID für API-Aufrufe von anonymen Nutzern.
 * Wird sowohl im Chat als auch in der Gallery verwendet.
 *
 * Der Anmeldezustand wird **hereingereicht**, nicht erfragt. Vorher rief dieser
 * Hook `useUser()` von Clerk — und weil die Galerie ihn nutzt, erreichte sie
 * ueber diesen Umweg weiterhin einen Auth-Anbieter, obwohl sie ihn nirgends
 * direkt importierte (Galerie-Audit, Nachtrag zum langen Schwanz).
 *
 * Wer Clerk ohnehin kennt, nimmt `useClerkSessionHeaders()` — dort sitzt die
 * Anbindung, an genau einer Stelle.
 */

import { useMemo } from 'react'
import { getOrCreateSessionId } from '@/lib/session/session-utils'

/**
 * Hook, der Session-ID Header für anonyme Nutzer zurückgibt
 *
 * @param isSignedIn Ob der Betrachter angemeldet ist
 * @returns Header-Objekt mit X-Session-ID, falls Nutzer anonym ist, sonst leeres Objekt
 */
export function useSessionHeaders(isSignedIn: boolean): Record<string, string> {
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
