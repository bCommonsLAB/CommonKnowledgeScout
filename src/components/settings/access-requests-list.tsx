"use client"

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
import { InviteUserDialog } from "@/components/settings/invite-user-dialog"
import type { LibraryAccessRequest } from "@/types/library-access"
import { useAccessRequestsActions } from "@/components/settings/hooks/use-access-requests-actions"

interface AccessRequestsListProps {
  libraryId: string
}

/**
 * Rendert den Status einer Zugriffsanfrage als Badge.
 */
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

/**
 * Gibt ein lesbares Label fuer die Anfrage-Quelle zurueck.
 */
function getSourceLabel(source: LibraryAccessRequest['source']): string {
  return source === 'self' ? 'Selbst-Anfrage' : 'Einladung'
}

/**
 * Komponente für Liste der Zugriffsanfragen.
 * 
 * Zeigt alle Zugriffsanfragen für eine Library an und ermöglicht
 * Genehmigung/Ablehnung sowie das Versenden von Einladungen.
 * 
 * Alle API-Aktionen und State-Verwaltung sind in useAccessRequestsActions extrahiert.
 */
export function AccessRequestsList({ libraryId }: AccessRequestsListProps) {
  const {
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
  } = useAccessRequestsActions({ libraryId })

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
