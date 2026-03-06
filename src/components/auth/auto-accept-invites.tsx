/**
 * @fileoverview Auto Accept Invites Component
 *
 * @description
 * Client-Komponente, die beim App-Start nach ausstehenden Einladungen sucht.
 * Zeigt einen Dialog, in dem der Benutzer jede Einladung annehmen oder ablehnen kann.
 * Wird im Root-Layout eingebunden.
 *
 * @module components/auth
 */

"use client"

import { useAutoAcceptInvites } from '@/hooks/use-auto-accept-invites'
import { PendingInvitesDialog } from './pending-invites-dialog'

export function AutoAcceptInvites() {
  const { pendingInvites, handleComplete } = useAutoAcceptInvites()

  if (pendingInvites.length === 0) return null

  return (
    <PendingInvitesDialog
      invites={pendingInvites}
      onComplete={handleComplete}
    />
  )
}
