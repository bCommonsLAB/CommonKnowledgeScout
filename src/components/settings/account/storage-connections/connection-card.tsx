"use client"

/**
 * Eine Speicher-Verbindung als Karte: Bezeichnung, Typ, Stand des letzten
 * Tests, OneDrive-Anmeldestatus und die Knopfzeile (Testen, Anmelden/
 * Abmelden, Bearbeiten, Löschen). Owner-Regel: die Zeile bricht nie um —
 * bei Platzmangel nur Symbol, der Text steht im Tooltip (title).
 */

import { useState } from "react"
import { LogIn, LogOut, Pencil, Plug, Trash2 } from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, CardContent,
} from '@ks/ui'
import type { StorageConnectionSummary } from "@/types/storage-connection"

interface ConnectionCardProps {
  connection: StorageConnectionSummary
  busy: boolean
  onTest: () => void
  onLogin: () => void
  onLogout: () => void
  onEdit: () => void
  onDelete: () => void
}

const TYP_TITEL: Record<StorageConnectionSummary["type"], string> = { nextcloud: "Nextcloud", onedrive: "OneDrive" }

function Aktion({ icon: Icon, text, onClick, disabled, variant = "outline" }: {
  icon: typeof Plug; text: string; onClick: () => void; disabled: boolean
  variant?: "outline" | "destructive" | "default"
}) {
  return (
    <Button type="button" size="sm" variant={variant} onClick={onClick} disabled={disabled} title={text} className="whitespace-nowrap shrink-0">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline sm:ml-2">{text}</span>
    </Button>
  )
}

function Zugang({ connection }: { connection: StorageConnectionSummary }) {
  if (connection.nextcloud) {
    return <p className="text-sm text-muted-foreground truncate">{connection.nextcloud.username} · {connection.nextcloud.webdavUrl}</p>
  }
  if (connection.onedrive) {
    return (
      <p className="text-sm text-muted-foreground truncate">
        Client {connection.onedrive.clientId} · {connection.onedrive.loggedIn ? "bei Microsoft angemeldet" : "noch nicht angemeldet"}
      </p>
    )
  }
  return null
}

function Testergebnis({ connection }: { connection: StorageConnectionSummary }) {
  const test = connection.lastTest
  if (!test) return <p className="text-xs text-muted-foreground">Noch nicht getestet.</p>
  const zeit = new Date(test.at).toLocaleString("de-DE")
  return (
    <p className={`text-xs ${test.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
      {test.ok ? "✓" : "✗"} {zeit}: {test.message}
    </p>
  )
}

export function ConnectionCard({ connection, busy, onTest, onLogin, onLogout, onEdit, onDelete }: ConnectionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const istOneDrive = connection.type === "onedrive"
  const angemeldet = connection.onedrive?.loggedIn === true

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{connection.label}</span>
              <Badge variant="secondary" className="shrink-0">{TYP_TITEL[connection.type]}</Badge>
            </div>
            <Zugang connection={connection} />
            <Testergebnis connection={connection} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Aktion icon={Plug} text="Testen" onClick={onTest} disabled={busy} />
            {istOneDrive && (angemeldet
              ? <Aktion icon={LogOut} text="Abmelden" onClick={onLogout} disabled={busy} />
              : <Aktion icon={LogIn} text="Anmelden" onClick={onLogin} disabled={busy} variant="default" />)}
            <Aktion icon={Pencil} text="Bearbeiten" onClick={onEdit} disabled={busy} />
            <Aktion icon={Trash2} text="Löschen" onClick={() => setConfirmDelete(true)} disabled={busy} variant="destructive" />
          </div>
        </div>
      </CardContent>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verbindung &bdquo;{connection.label}&ldquo; löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Zugangsdaten werden unwiderruflich entfernt. Solange eine Bibliothek auf dieser Verbindung liegt, wird das Löschen abgelehnt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <AlertDialogCancel className="whitespace-nowrap">Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="whitespace-nowrap" onClick={onDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
