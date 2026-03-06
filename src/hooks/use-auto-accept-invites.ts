/**
 * @fileoverview Pending Invites Hook
 *
 * @description
 * Lädt beim Login/App-Start ausstehende Einladungen (Co-Creator, Moderator, Reader).
 * Gibt die Einladungen zurück, damit die UI einen Dialog anzeigen kann.
 * Akzeptiert NICHT automatisch – der Benutzer entscheidet selbst.
 *
 * @module hooks
 */

"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useStorage } from '@/contexts/storage-context'
import { useAtom } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import type { PendingInvite } from '@/app/api/user/accept-pending-invites/route'

export function useAutoAcceptInvites() {
  const { user, isLoaded } = useUser()
  const { refreshLibraries } = useStorage()
  const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const hasCheckedRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      hasCheckedRef.current = false
      lastUserIdRef.current = null
      setPendingInvites([])
      return
    }

    const currentUserId = user.id
    if (currentUserId === lastUserIdRef.current) return

    const email = user.emailAddresses?.[0]?.emailAddress
    if (email && !hasCheckedRef.current) {
      hasCheckedRef.current = true
      lastUserIdRef.current = currentUserId

      fetch('/api/user/accept-pending-invites')
        .then(async (res) => {
          if (!res.ok) {
            console.warn('[useAutoAcceptInvites] Fehler beim Laden:', res.status)
            return
          }
          const data = await res.json()
          if (data.invites && data.invites.length > 0) {
            console.log(`[useAutoAcceptInvites] ${data.invites.length} ausstehende Einladung(en) gefunden`)
            setPendingInvites(data.invites)
          }
        })
        .catch((err) => {
          console.error('[useAutoAcceptInvites] Fehler:', err)
        })
    }
  }, [user, isLoaded])

  /**
   * Wird nach Abschluss des Dialogs aufgerufen.
   * Lädt die Library-Liste neu und wählt die zuletzt akzeptierte Library aus.
   */
  const handleComplete = useCallback(async (lastAcceptedLibraryId?: string) => {
    setPendingInvites([])

    // Library-Liste neu laden, damit die akzeptierte Library sofort sichtbar ist
    await refreshLibraries()

    // Akzeptierte Library auswählen und in localStorage speichern
    if (lastAcceptedLibraryId) {
      setActiveLibraryId(lastAcceptedLibraryId)
      localStorage.setItem('activeLibraryId', lastAcceptedLibraryId)
    }
  }, [refreshLibraries, setActiveLibraryId])

  return { pendingInvites, handleComplete }
}
