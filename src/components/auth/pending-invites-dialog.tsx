"use client"

/**
 * @fileoverview Dialog für ausstehende Einladungen
 *
 * Zeigt beim App-Start einen Dialog, wenn der Benutzer ausstehende
 * Einladungen (Co-Creator, Moderator, Reader) hat.
 * Der Benutzer kann jede Einladung einzeln annehmen oder ablehnen.
 * Beim Schließen wird die Library-Liste automatisch aktualisiert
 * und die zuletzt akzeptierte Library ausgewählt.
 */

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2, UserPlus } from 'lucide-react'
import type { PendingInvite } from '@/app/api/user/accept-pending-invites/route'

interface PendingInvitesDialogProps {
  invites: PendingInvite[]
  /** Wird beim Schließen aufgerufen – mit der ID der zuletzt akzeptierten Library */
  onComplete: (lastAcceptedLibraryId?: string) => void
}

function roleLabel(role: string): string {
  switch (role) {
    case 'co-creator': return 'Co-Creator'
    case 'moderator': return 'Moderator'
    case 'reader': return 'Leser'
    default: return role
  }
}

export function PendingInvitesDialog({ invites, onComplete }: PendingInvitesDialogProps) {
  const [open, setOpen] = useState(true)
  const [states, setStates] = useState<Record<string, string>>(
    () => Object.fromEntries(invites.map(i => [i.libraryId, 'pending']))
  )
  // Merkt sich die ID der zuletzt akzeptierten Library
  const lastAcceptedRef = useRef<string | undefined>(undefined)

  const allProcessed = invites.every(i => {
    const s = states[i.libraryId]
    return s === 'accepted' || s === 'declined' || s === 'error'
  })

  async function handleAction(invite: PendingInvite, action: 'accept' | 'decline') {
    const key = invite.libraryId
    setStates(prev => ({ ...prev, [key]: action === 'accept' ? 'accepting' : 'declining' }))

    try {
      const res = await fetch('/api/user/accept-pending-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId: invite.libraryId,
          type: invite.type,
          action,
        }),
      })

      if (!res.ok) {
        setStates(prev => ({ ...prev, [key]: 'error' }))
        return
      }

      if (action === 'accept') {
        lastAcceptedRef.current = invite.libraryId
      }

      setStates(prev => ({ ...prev, [key]: action === 'accept' ? 'accepted' : 'declined' }))
    } catch {
      setStates(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  function handleClose() {
    setOpen(false)
    onComplete(lastAcceptedRef.current)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {invites.length === 1 ? 'Einladung erhalten' : `${invites.length} Einladungen erhalten`}
          </DialogTitle>
          <DialogDescription>
            Du wurdest zu {invites.length === 1 ? 'einem Archiv' : 'folgenden Archiven'} eingeladen.
            Möchtest du die Einladung{invites.length > 1 ? 'en' : ''} annehmen?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {invites.map(invite => {
            const state = states[invite.libraryId]
            const isProcessing = state === 'accepting' || state === 'declining'
            const isDone = state === 'accepted' || state === 'declined'

            return (
              <div
                key={invite.libraryId}
                className={`flex items-center justify-between rounded-lg border p-3 transition-opacity ${
                  isDone ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{invite.libraryLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    als {roleLabel(invite.role)} · von {invite.invitedBy}
                  </p>
                </div>

                <div className="flex gap-2 ml-3 shrink-0">
                  {state === 'accepted' && (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <Check className="h-4 w-4" /> Angenommen
                    </span>
                  )}
                  {state === 'declined' && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <X className="h-4 w-4" /> Abgelehnt
                    </span>
                  )}
                  {state === 'error' && (
                    <span className="text-sm text-destructive">Fehler</span>
                  )}
                  {state === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(invite, 'decline')}
                      >
                        Ablehnen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(invite, 'accept')}
                      >
                        Annehmen
                      </Button>
                    </>
                  )}
                  {isProcessing && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant={allProcessed ? 'default' : 'outline'}
            onClick={handleClose}
          >
            {allProcessed ? 'Schließen' : 'Später entscheiden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
