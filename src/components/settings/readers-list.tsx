"use client"

/**
 * ReadersList — Uebersicht aller Personen mit Lesezugriff
 * (Welle 3-IV-UX-4: Leser waren bisher nirgends sichtbar).
 *
 * Leser sind genehmigte Zugriffsanfragen (LibraryAccessRequest,
 * status 'approved') — kein LibraryMember-Eintrag. Bewusst schlanke
 * Komponente mit eigenem Load (nur approved); das Entziehen nutzt die
 * DELETE-Route, die seit dem D4-Fix auch den Access-Check-Cache
 * invalidiert.
 */

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { LibraryAccessRequest } from "@/types/library-access"

interface ReadersListProps {
  libraryId: string
}

export function ReadersList({ libraryId }: ReadersListProps) {
  const [readers, setReaders] = useState<LibraryAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadReaders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/libraries/${libraryId}/access-requests?status=approved`
      )
      if (!response.ok) {
        throw new Error("Leser konnten nicht geladen werden")
      }
      const data = await response.json()
      setReaders(Array.isArray(data.requests) ? data.requests : [])
    } catch (err) {
      console.error("[ReadersList] Fehler beim Laden:", err)
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally {
      setLoading(false)
    }
  }, [libraryId])

  useEffect(() => {
    void loadReaders()
  }, [loadReaders])

  const revokeAccess = async (request: LibraryAccessRequest) => {
    setRemovingId(request.id)
    try {
      const response = await fetch(
        `/api/libraries/${libraryId}/access-requests/${request.id}`,
        { method: "DELETE" }
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Fehler beim Entziehen des Zugriffs")
      }
      toast.success("Lesezugriff entzogen", {
        description: `${request.userEmail} hat keinen Zugriff mehr auf diese Bibliothek.`,
      })
      await loadReaders()
    } catch (err) {
      console.error("[ReadersList] Fehler beim Entziehen:", err)
      toast.error("Fehler", {
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
      })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-medium">Leser</h4>
          <p className="text-sm text-muted-foreground">
            Personen mit Lesezugriff (eingeladen oder per genehmigter Anfrage).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadReaders()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && !loading && readers.length === 0 && (
        <Alert>
          <AlertDescription>
            Noch keine Leser. Laden Sie Personen mit der Rolle „Leser“ ein —
            nach Annahme erscheinen sie hier.
          </AlertDescription>
        </Alert>
      )}

      {readers.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Zugriff seit</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readers.map((reader) => (
                <TableRow key={reader.id}>
                  <TableCell className="font-medium">{reader.userName}</TableCell>
                  <TableCell>{reader.userEmail}</TableCell>
                  <TableCell>
                    {reader.reviewedAt
                      ? new Date(reader.reviewedAt).toLocaleDateString("de-DE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ConfirmActionDialog
                      title={`Lesezugriff von ${reader.userEmail} entziehen?`}
                      description="Die Person kann diese Bibliothek danach nicht mehr lesen. Sie kann jederzeit eine neue Zugriffsanfrage stellen."
                      confirmLabel="Zugriff entziehen"
                      destructive
                      onConfirm={() => void revokeAccess(reader)}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={removingId === reader.id}
                        >
                          {removingId === reader.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Entziehen
                            </>
                          )}
                        </Button>
                      }
                    />
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
