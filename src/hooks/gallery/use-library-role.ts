'use client'

import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { useAuth, useUser } from '@clerk/nextjs'
import { librariesAtom } from '@/atoms/library-atom'
import { getPreferredUserEmail } from '@/lib/auth/user-email'

/**
 * Mögliche Rollen des aktuellen Users in einer bestimmten Library.
 * - `owner` / `co-creator` / `contributor` / `moderator` / `reader`: aus `librariesAtom.accessRole`.
 * - `guest`: eingeloggt, aber Library nicht im Atom (z.B. fremder
 *   Explore-Besucher mit Account auf einer Public-Library).
 * - `anonymous`: nicht eingeloggt.
 */
export type LibraryRoleClient =
  | 'owner'
  | 'co-creator'
  | 'contributor'
  | 'moderator'
  | 'reader'
  | 'guest'
  | 'anonymous'

export interface UseLibraryRoleResult {
  role: LibraryRoleClient
  /** true wenn `role` Owner oder Co-Creator (Schreib-/Mod-Berechtigungen). */
  isMember: boolean
  /** true wenn ueberhaupt ein Clerk-User aktiv ist. */
  isSignedIn: boolean
  /** true solange Clerk noch laedt - UI sollte Buttons nicht zeigen. */
  isLoading: boolean
  /** Normalisierte E-Mail des aktuellen Users (oder leer). */
  userEmail: string
}

/**
 * Zentraler UI-Gate fuer rolelhaengige Features (Favoriten, Kommentare,
 * Moderation). Liest `accessRole` aus dem `librariesAtom` (kommt aus
 * `GET /api/libraries`) und kombiniert sie mit dem Clerk-Session-Status.
 *
 * Der serverseitige Wahrheitswert bleibt `isCoCreatorOrOwner` in den
 * API-Routen - dieser Hook ist nur fuer das Conditional-Rendering der
 * UI-Elemente gedacht.
 */
export function useLibraryRole(libraryId?: string): UseLibraryRoleResult {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const libraries = useAtomValue(librariesAtom)

  return useMemo<UseLibraryRoleResult>(() => {
    const userEmail = isSignedIn ? getPreferredUserEmail(user) : ''

    if (!isLoaded) {
      return {
        role: 'anonymous',
        isMember: false,
        isSignedIn: false,
        isLoading: true,
        userEmail,
      }
    }
    if (!isSignedIn) {
      return {
        role: 'anonymous',
        isMember: false,
        isSignedIn: false,
        isLoading: false,
        userEmail: '',
      }
    }
    if (!libraryId) {
      return {
        role: 'guest',
        isMember: false,
        isSignedIn: true,
        isLoading: false,
        userEmail,
      }
    }

    const lib = libraries.find((l) => l.id === libraryId)
    if (!lib) {
      return {
        role: 'guest',
        isMember: false,
        isSignedIn: true,
        isLoading: false,
        userEmail,
      }
    }

    // accessRole stammt aus /api/libraries; fehlt sie (eigene Library), ist
    // der User per Definition Owner.
    const role: LibraryRoleClient = lib.accessRole ?? 'owner'
    const isMember = role === 'owner' || role === 'co-creator'
    return { role, isMember, isSignedIn: true, isLoading: false, userEmail }
  }, [isLoaded, isSignedIn, user, libraryId, libraries])
}
