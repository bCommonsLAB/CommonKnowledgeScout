/**
 * @fileoverview Hook für MembersList-Aktionen
 *
 * @description
 * Extrahiert alle API-Aktionen und State-Verwaltung aus members-list.tsx.
 * Der Hook kapselt:
 * - Mitglieder laden (loadMembers)
 * - Mitglied einladen (handleInviteMember) inkl. Dialog-State
 * - Einladung erneut senden (handleResendInvite)
 * - Mitglied entfernen (handleRemoveMember)
 *
 * @module settings/hooks
 */

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import type { LibraryMember, LibraryRole } from '@/types/library-members'

interface UseMembersActionsOptions {
  libraryId: string
}

interface UseMembersActionsReturn {
  /** Geladene Mitglieder-Liste */
  members: LibraryMember[]
  /** Lade-Zustand (initial und bei Reload) */
  loading: boolean
  /** Fehler beim Laden, oder null */
  error: string | null
  /** Lädt die Mitglieder-Liste neu */
  loadMembers: () => Promise<void>

  /** Dialog-Zustand für Einladungsformular */
  isDialogOpen: boolean
  setIsDialogOpen: (open: boolean) => void
  /** E-Mail-Eingabe im Einladungs-Dialog */
  newMemberEmail: string
  setNewMemberEmail: (email: string) => void
  /** Rollen-Auswahl im Einladungs-Dialog */
  newMemberRole: LibraryRole
  setNewMemberRole: (role: LibraryRole) => void
  /** Fehlermeldung innerhalb des Dialogs */
  dialogError: string | null
  /** Wird gesetzt wenn Einladung gesendet wird */
  isAddingMember: boolean
  /** Sendet Einladung (nutzt newMemberEmail + newMemberRole) */
  handleInviteMember: () => Promise<void>

  /** E-Mail der Person, fuer die gerade Resend laeuft (oder null) */
  resendingEmail: string | null
  /** Sendet Einladungs-E-Mail erneut */
  handleResendInvite: (email: string) => Promise<void>

  /** E-Mail der Person, die gerade entfernt wird (oder null) */
  removingEmail: string | null
  /** Entfernt Mitglied oder zieht Einladung zurueck */
  handleRemoveMember: (email: string, memberStatus?: string) => Promise<void>
}

/**
 * Hook fuer alle Aktionen der MembersList-Komponente.
 * Laed initial die Mitglieder und stellt alle CRUD-Aktionen bereit.
 */
export function useMembersActions({
  libraryId,
}: UseMembersActionsOptions): UseMembersActionsReturn {
  const { toast } = useToast()
  const [members, setMembers] = useState<LibraryMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Dialog-State ---
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<LibraryRole>('co-creator')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  // --- Lade-State ---
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)

  /** Laedt die aktuelle Mitglieder-Liste vom API */
  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/members`)

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Mitglieder')
      }

      const data = await response.json()
      setMembers(data.members ?? [])
    } catch (err) {
      console.error('[useMembersActions] Mitglieder konnten nicht geladen werden:', err)
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [libraryId])

  // Initial-Load
  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  /** Sendet Einladung fuer neues Mitglied */
  async function handleInviteMember() {
    setDialogError(null)

    if (!newMemberEmail || !newMemberEmail.includes('@')) {
      setDialogError('Bitte geben Sie eine gueltige E-Mail-Adresse ein.')
      return
    }

    setIsAddingMember(true)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail.trim(),
          role: newMemberRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setDialogError(data.error ?? 'Fehler beim Einladen des Mitglieds')
        return
      }

      const roleLabel = newMemberRole === 'co-creator' ? 'Co-Creator' : newMemberRole === 'contributor' ? 'Mitwirkender' : 'Moderator'
      toast({
        title: 'Einladung gesendet',
        description: data.emailSent
          ? `Einladung als ${roleLabel} an ${newMemberEmail} gesendet.`
          : `Einladung als ${roleLabel} erstellt. E-Mail konnte nicht gesendet werden.`,
      })

      setNewMemberEmail('')
      setNewMemberRole('co-creator')
      setDialogError(null)
      setIsDialogOpen(false)
      await loadMembers()
    } catch (err) {
      console.error('[useMembersActions] Fehler beim Einladen des Mitglieds:', err)
      setDialogError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIsAddingMember(false)
    }
  }

  /** Sendet Einladungs-E-Mail erneut (nur fuer pending-Mitglieder) */
  async function handleResendInvite(email: string) {
    setResendingEmail(email)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Fehler beim erneuten Senden')
      }

      toast({
        title: 'Einladung erneut gesendet',
        description: data.message,
      })

      await loadMembers()
    } catch (err) {
      console.error('[useMembersActions] Fehler beim erneuten Senden der Einladung:', err)
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setResendingEmail(null)
    }
  }

  /** Entfernt Mitglied oder zieht ausstehende Einladung zurueck */
  async function handleRemoveMember(email: string, memberStatus?: string) {
    const label = memberStatus === 'pending' ? 'die Einladung zurueckziehen' : 'das Mitglied entfernen'
    if (!confirm(`Moechten Sie ${label} fuer ${email}?`)) {
      return
    }

    setRemovingEmail(email)

    try {
      const url = `/api/libraries/${libraryId}/members?email=${encodeURIComponent(email)}`
      const response = await fetch(url, { method: 'DELETE' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Fehler beim Entfernen des Mitglieds')
      }

      toast({
        title: 'Erfolg',
        description:
          memberStatus === 'pending'
            ? `Einladung fuer ${email} wurde zurueckgezogen.`
            : `Mitglied ${email} wurde entfernt.`,
      })

      await loadMembers()
    } catch (err) {
      console.error('[useMembersActions] Fehler beim Entfernen des Mitglieds:', err)
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setRemovingEmail(null)
    }
  }

  return {
    members,
    loading,
    error,
    loadMembers,
    isDialogOpen,
    setIsDialogOpen,
    newMemberEmail,
    setNewMemberEmail,
    newMemberRole,
    setNewMemberRole,
    dialogError,
    isAddingMember,
    handleInviteMember,
    resendingEmail,
    handleResendInvite,
    removingEmail,
    handleRemoveMember,
  }
}
