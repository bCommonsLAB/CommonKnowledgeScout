/**
 * @fileoverview Hook für AccessRequestsList-Aktionen
 *
 * @description
 * Extrahiert alle API-Aktionen und State-Verwaltung aus access-requests-list.tsx.
 * Der Hook kapselt:
 * - Zugriffsanfragen laden (loadRequests), inkl. Status-Filter
 * - Status-Update (genehmigen/ablehnen) via updateRequestStatus
 * - Anfrage loeschen (handleDeleteRequest)
 * - Einladung erneut versenden (handleResendInvite)
 * - Hilfsfunktionen: getStatusBadge, getSourceLabel
 *
 * @module settings/hooks
 */

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import type { LibraryAccessRequest } from '@/types/library-access'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

interface UseAccessRequestsActionsOptions {
  libraryId: string
}

interface UseAccessRequestsActionsReturn {
  /** Geladene Zugriffsanfragen */
  requests: LibraryAccessRequest[]
  /** Lade-Zustand */
  loading: boolean
  /** Fehler beim Laden, oder null */
  error: string | null
  /** Aktueller Status-Filter */
  statusFilter: StatusFilter
  /** Aendert den Status-Filter (loest Reload aus) */
  setStatusFilter: (filter: StatusFilter) => void
  /** Laedt die Anfragen neu */
  loadRequests: () => Promise<void>
  /** Set der IDs, die gerade bearbeitet werden */
  processingIds: Set<string>
  /** Genehmigt oder lehnt eine Anfrage ab */
  updateRequestStatus: (requestId: string, status: 'approved' | 'rejected') => Promise<void>
  /** Loescht eine Zugriffsanfrage */
  handleDeleteRequest: (requestId: string) => Promise<void>
  /** Sendet Einladungs-E-Mail erneut */
  handleResendInvite: (requestId: string) => Promise<void>
}

/**
 * Hook fuer alle Aktionen der AccessRequestsList-Komponente.
 * Laedt Anfragen initial und bei Filter-Aenderungen und stellt
 * alle CRUD-Aktionen bereit.
 */
export function useAccessRequestsActions({
  libraryId,
}: UseAccessRequestsActionsOptions): UseAccessRequestsActionsReturn {
  const { toast } = useToast()
  const [requests, setRequests] = useState<LibraryAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  /** Laedt Zugriffsanfragen (mit optionalem Status-Filter) */
  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const url = `/api/libraries/${libraryId}/access-requests${
        statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      }`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Zugriffsanfragen')
      }

      const data = await response.json()
      setRequests(data.requests ?? [])
    } catch (err) {
      console.error('[useAccessRequestsActions] Zugriffsanfragen konnten nicht geladen werden:', err)
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [libraryId, statusFilter])

  // Initial-Load und Reload bei Filter-Aenderung
  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  /** Hilfsfunktion: fuegt eine ID zum Processing-Set hinzu */
  function addProcessingId(id: string) {
    setProcessingIds((prev) => new Set(prev).add(id))
  }

  /** Hilfsfunktion: entfernt eine ID aus dem Processing-Set */
  function removeProcessingId(id: string) {
    setProcessingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  /** Genehmigt oder lehnt eine Zugriffsanfrage ab */
  async function updateRequestStatus(requestId: string, status: 'approved' | 'rejected') {
    addProcessingId(requestId)

    try {
      const response = await fetch(
        `/api/libraries/${libraryId}/access-requests/${requestId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Fehler beim Aktualisieren des Status')
      }

      toast({
        title: 'Erfolg',
        description: `Zugriffsanfrage wurde ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}`,
      })

      await loadRequests()
    } catch (err) {
      console.error('[useAccessRequestsActions] Fehler beim Aktualisieren des Status:', err)
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      removeProcessingId(requestId)
    }
  }

  /**
   * Loescht eine Zugriffsanfrage. Die Bestaetigung uebernimmt der
   * ConfirmActionDialog in der Liste (Welle 3-IV-UX-3d).
   */
  async function handleDeleteRequest(requestId: string) {
    addProcessingId(requestId)

    try {
      const response = await fetch(
        `/api/libraries/${libraryId}/access-requests/${requestId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Fehler beim Löschen der Zugriffsanfrage')
      }

      toast({
        title: 'Erfolg',
        description: 'Zugriffsanfrage wurde erfolgreich gelöscht',
      })

      await loadRequests()
    } catch (err) {
      console.error('[useAccessRequestsActions] Fehler beim Loeschen der Zugriffsanfrage:', err)
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      removeProcessingId(requestId)
    }
  }

  /** Sendet Einladungs-E-Mail erneut (nur fuer moderatorInvite + pending) */
  async function handleResendInvite(requestId: string) {
    addProcessingId(requestId)

    try {
      const response = await fetch(
        `/api/libraries/${libraryId}/access-requests/${requestId}/resend`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Fehler beim erneuten Versenden der Einladung')
      }

      toast({
        title: 'Erfolg',
        description: 'Einladung wurde erfolgreich erneut versendet',
      })
    } catch (err) {
      console.error('[useAccessRequestsActions] Fehler beim erneuten Versenden der Einladung:', err)
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      removeProcessingId(requestId)
    }
  }

  return {
    requests,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    loadRequests,
    processingIds,
    updateRequestStatus,
    handleDeleteRequest,
    handleResendInvite,
  }
}
