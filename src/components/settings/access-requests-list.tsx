"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Mail, Trash2, Send, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { InviteUserDialog } from "@/components/settings/invite-user-dialog"
import type { LibraryAccessRequest } from "@/types/library-access"

interface AccessRequestsListProps {
  libraryId: string
}

/**
 * Komponente für Liste der Zugriffsanfragen
 * 
 * Zeigt alle Zugriffsanfragen für eine Library an und ermöglicht
 * Genehmigung/Ablehnung sowie das Versenden von Einladungen.
 */
export function AccessRequestsList({ libraryId }: AccessRequestsListProps) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<LibraryAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const url = `/api/libraries/${libraryId}/access-requests${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Zugriffsanfragen')
      }

      const data = await response.json()
      setRequests(data.requests || [])
    } catch (err) {
      console.error('Fehler beim Laden der Zugriffsanfragen:', err)
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [libraryId, statusFilter])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function updateRequestStatus(requestId: string, status: 'approved' | 'rejected') {
    setProcessingIds(prev => new Set(prev).add(requestId))

    try {
      const response = await fetch(`/api/libraries/${libraryId}/access-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Aktualisieren des Status')
      }

      toast({
        title: "Erfolg",
        description: `Zugriffsanfrage wurde ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}`,
      })

      // Liste neu laden
      await loadRequests()
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Status:', err)
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: "destructive",
      })
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
    }
  }

  async function handleDeleteRequest(requestId: string) {
    if (!confirm('Möchten Sie diese Zugriffsanfrage wirklich löschen?')) {
      return
    }

    setProcessingIds(prev => new Set(prev).add(requestId))

    try {
      const response = await fetch(`/api/libraries/${libraryId}/access-requests/${requestId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Löschen der Zugriffsanfrage')
      }

      toast({
        title: "Erfolg",
        description: 'Zugriffsanfrage wurde erfolgreich gelöscht',
      })

      // Liste neu laden
      await loadRequests()
    } catch (err) {
      console.error('Fehler beim Löschen der Zugriffsanfrage:', err)
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: "destructive",
      })
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
    }
  }

  async function handleResendInvite(requestId: string) {
    setProcessingIds(prev => new Set(prev).add(requestId))

    try {
      const response = await fetch(`/api/libraries/${libraryId}/access-requests/${requestId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim erneuten Versenden der Einladung')
      }

      toast({
        title: "Erfolg",
        description: 'Einladung wurde erfolgreich erneut versendet',
      })
    } catch (err) {
      console.error('Fehler beim erneuten Versenden der Einladung:', err)
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: "destructive",
      })
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(requestId)
        return next
      })
    }
  }

  function getStatusBadge(status: LibraryAccessRequest['status']) {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Ausstehend</Badge>
      case 'approved':
        return <Badge variant="default" className="bg-green-500">Genehmigt</Badge>
      case 'rejected':
        return <Badge variant="destructive">Abgelehnt</Badge>
    }
  }

  function getSourceLabel(source: LibraryAccessRequest['source']) {
    return source === 'self' ? 'Selbst-Anfrage' : 'Einladung'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Einladungs-Button und Filter */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <InviteUserDialog libraryId={libraryId} onInviteSent={loadRequests} />
          <Button
            variant="outline"
            onClick={loadRequests}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aktualisieren
          </Button>
        </div>
        <div className="flex gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Alle
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('pending')}
        >
          Ausstehend
        </Button>
        <Button
          variant={statusFilter === 'approved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('approved')}
        >
          Genehmigt
        </Button>
        <Button
          variant={statusFilter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('rejected')}
        >
          Abgelehnt
        </Button>
        </div>
      </div>

      {/* Leere Liste */}
      {requests.length === 0 && (
        <Alert>
          <AlertDescription>
            {statusFilter === 'all' 
              ? 'Keine Zugriffsanfragen vorhanden.'
              : `Keine ${statusFilter === 'pending' ? 'ausstehenden' : statusFilter === 'approved' ? 'genehmigten' : 'abgelehnten'} Zugriffsanfragen vorhanden.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabelle */}
      {requests.length > 0 && (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Benutzer</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Quelle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Angefragt am</TableHead>
              <TableHead>Eingeladen von</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.userName}</TableCell>
                <TableCell>{request.userEmail}</TableCell>
                <TableCell>
                  {request.source === 'moderatorInvite' && (
                    <Mail className="inline h-4 w-4 mr-1" />
                  )}
                  {getSourceLabel(request.source)}
                </TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>
                  {new Date(request.requestedAt).toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  {request.invitedBy ? (
                    <span className="text-sm text-muted-foreground">{request.invitedBy}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {request.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateRequestStatus(request.id, 'approved')}
                          disabled={processingIds.has(request.id)}
                        >
                          {processingIds.has(request.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Genehmigen
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateRequestStatus(request.id, 'rejected')}
                          disabled={processingIds.has(request.id)}
                        >
                          {processingIds.has(request.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Ablehnen
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    {/* Neu senden Button nur für Einladungen */}
                    {request.source === 'moderatorInvite' && request.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendInvite(request.id)}
                        disabled={processingIds.has(request.id)}
                      >
                        {processingIds.has(request.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            Neu senden
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteRequest(request.id)}
                      disabled={processingIds.has(request.id)}
                    >
                      {processingIds.has(request.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Entfernen
                        </>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  )
}

