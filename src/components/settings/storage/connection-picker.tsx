"use client"

/**
 * Verbindung waehlen (Archive · 1 Quelle, Schritt 2): Speicher-Verbindungen
 * des Kontos vom gewaehlten Typ als waehlbare Karten; Pflege und Anmeldung
 * laufen unter Mein Konto → Speicher-Verbindungen.
 */

import Link from "next/link"
import { Check, ExternalLink } from "lucide-react"
import { Card, CardContent } from '@ks/ui'
import type { StorageConnectionSummary, StorageConnectionType } from "@/types/storage-connection"

export const STORAGE_CONNECTIONS_HREF = "/settings/account/storage-connections"

interface ConnectionPickerProps {
  type: StorageConnectionType
  connections: StorageConnectionSummary[] | null
  error: string | null
  value: string
  onChange: (connectionId: string) => void
}

function Zustand({ connection }: { connection: StorageConnectionSummary }) {
  if (connection.type === "onedrive") {
    return (
      <span className={connection.onedrive?.loggedIn ? "text-green-700 dark:text-green-400" : "text-destructive"}>
        {connection.onedrive?.loggedIn ? "bei Microsoft angemeldet" : "noch nicht angemeldet"}
      </span>
    )
  }
  const test = connection.lastTest
  if (!test) return <span className="text-muted-foreground">noch nicht getestet</span>
  return <span className={test.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}>{test.ok ? "Test ok" : "Test fehlgeschlagen"}</span>
}

export function ConnectionPicker({ type, connections, error, value, onChange }: ConnectionPickerProps) {
  const passend = (connections ?? []).filter((c) => c.type === type)
  const typTitel = type === "nextcloud" ? "Nextcloud" : "OneDrive"
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Welche {typTitel}-Verbindung Ihres Kontos soll diese Bibliothek nutzen?
      </p>
      {error && <p className="text-sm text-destructive">Verbindungen konnten nicht geladen werden: {error}</p>}
      {connections === null && !error && <p className="text-sm text-muted-foreground">Lädt...</p>}
      {connections !== null && passend.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine {typTitel}-Verbindung im Konto. Legen Sie eine an, dann wählen Sie sie hier.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {passend.map((connection) => {
          const gewaehlt = connection.id === value
          return (
            <Card
              key={connection.id}
              role="button"
              onClick={() => onChange(connection.id)}
              className={`cursor-pointer transition-colors ${gewaehlt ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"}`}
            >
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{connection.label}</span>
                  {gewaehlt && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {connection.nextcloud ? `${connection.nextcloud.username} · ${connection.nextcloud.webdavUrl}` : `Client ${connection.onedrive?.clientId ?? ""}`}
                </p>
                <p className="text-xs"><Zustand connection={connection} /></p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Link href={STORAGE_CONNECTIONS_HREF} className="inline-flex items-center gap-1 text-sm underline whitespace-nowrap">
        Verbindungen verwalten <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  )
}
