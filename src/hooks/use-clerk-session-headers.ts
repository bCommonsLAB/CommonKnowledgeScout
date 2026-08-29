'use client'

/**
 * @fileoverview Session-Header fuer Aufrufer, die Clerk ohnehin kennen.
 *
 * @description
 * `useSessionHeaders` bekommt den Anmeldezustand hereingereicht, damit die
 * Galerie ihn aus ihrem Betrachter speisen kann und keinen Auth-Anbieter
 * braucht. Chat- und App-Code, der ohnehin in Clerk-Land lebt, nimmt diesen
 * Wrapper — so sitzt die Clerk-Anbindung an EINER Stelle statt an fuenf.
 *
 * @module hooks
 */

import { useUser } from '@clerk/nextjs'
import { useSessionHeaders } from './use-session-headers'

export function useClerkSessionHeaders(): Record<string, string> {
  const { isSignedIn } = useUser()
  return useSessionHeaders(isSignedIn === true)
}
