"use client"

/**
 * Konto-Seite „Speicher-Verbindungen" (Plan speicher-verbindungen-und-library-anlage,
 * Teil A, A1): Liste der Verbindungen der Person, anlegen, testen, OneDrive-
 * Login, bearbeiten, löschen. Noch zeigt keine Library auf eine Verbindung
 * (das kommt mit A2).
 */

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Button, toast } from '@ks/ui'
import type { StorageConnectionSummary } from "@/types/storage-connection"
import { useStorageConnections } from "./use-storage-connections"
import { ConnectionCard } from "./connection-card"
import { ConnectionFormDialog } from "./connection-form-dialog"

export function StorageConnectionsSection() {
  const { connections, loadError, busyId, create, update, remove, test, login, logout } = useStorageConnections()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StorageConnectionSummary | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const gemeldet = useRef(false)

  // Rueckkehr vom OneDrive-Login: ?onedrive=ok|error&message=… einmal melden, dann die URL bereinigen.
  useEffect(() => {
    const ergebnis = searchParams.get("onedrive")
    if (!ergebnis || gemeldet.current) return
    gemeldet.current = true
    if (ergebnis === "ok") {
      toast({ title: "Bei Microsoft angemeldet", description: "Die Anmeldung ist an der Verbindung gespeichert. Jetzt testen." })
    } else {
      toast({ title: "OneDrive-Anmeldung fehlgeschlagen", description: searchParams.get("message") ?? "Unbekannter Fehler", variant: "destructive" })
    }
    router.replace("/settings/account/storage-connections")
  }, [searchParams, router])

  const openCreate = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (connection: StorageConnectionSummary) => { setEditing(connection); setDialogOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Nextcloud- und OneDrive-Zugänge, einmal am Konto gepflegt und verschlüsselt gespeichert.
          Eine Bibliothek zeigt künftig nur noch auf Verbindung plus Verzeichnis.
        </p>
        <Button type="button" size="sm" onClick={openCreate} className="whitespace-nowrap shrink-0" title="Neue Verbindung">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline sm:ml-2">Neue Verbindung</span>
        </Button>
      </div>

      {loadError && <p className="text-sm text-destructive">Verbindungen konnten nicht geladen werden: {loadError}</p>}
      {connections === null && !loadError && <p className="text-sm text-muted-foreground">Lädt...</p>}
      {connections?.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Verbindung. Legen Sie die erste an und testen Sie sie.</p>
      )}
      {connections?.map((connection) => (
        <ConnectionCard
          key={connection.id}
          connection={connection}
          busy={busyId === connection.id}
          onTest={() => void test(connection.id)}
          onLogin={() => void login(connection.id)}
          onLogout={() => void logout(connection.id)}
          onEdit={() => openEdit(connection)}
          onDelete={() => void remove(connection.id)}
        />
      ))}

      <ConnectionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
        onSubmit={(input) => (editing ? update(editing.id, input) : create(input))}
      />
    </div>
  )
}
