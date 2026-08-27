"use client"

/**
 * @fileoverview Account-Einstellungen: MCP-Zugang fuer Claude (Stufe 2).
 *
 * @description
 * Account-Domaene (nicht Library): EIN Key pro Konto, gueltig fuer alle
 * Bibliotheken des Users. Der Klartext-Key steckt NUR im heruntergeladenen
 * Erweiterungs-Bundle; die Seite zeigt sonst ausschliesslich Status.
 * Download = Rotation: ein aelteres Bundle wird dabei ungueltig.
 */

import { useCallback, useEffect, useState } from "react"
import { Button, Card, CardContent } from '@ks/ui'

interface KeyStatus {
  configured: boolean
  updatedAt: string | null
}

export function McpBridgeSection() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/account/mcp-key")
      if (!response.ok) throw new Error(`Status-Abruf fehlgeschlagen (HTTP ${response.status})`)
      setStatus((await response.json()) as KeyStatus)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleDownload = async () => {
    setIsWorking(true)
    setError(null)
    try {
      const response = await fetch("/api/account/mcp-extension", { method: "POST" })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Download fehlgeschlagen (HTTP ${response.status})`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "knowledgescout.mcpb"
      anchor.click()
      URL.revokeObjectURL(url)
      await loadStatus()
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : String(downloadError))
    } finally {
      setIsWorking(false)
    }
  }

  const handleRevoke = async () => {
    setIsWorking(true)
    setError(null)
    try {
      const response = await fetch("/api/account/mcp-key", { method: "DELETE" })
      if (!response.ok && response.status !== 404) {
        throw new Error(`Widerruf fehlgeschlagen (HTTP ${response.status})`)
      }
      await loadStatus()
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : String(revokeError))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Claude-Zugang (MCP)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Verbindet Claude (Cowork/Desktop) mit deinen Bibliotheken. Der Zugangsschlüssel
            gilt für dein ganzes Konto — alle Bibliotheken, die du hier siehst.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm font-medium">
            {status === null
              ? "Status wird geladen…"
              : status.configured
                ? "Zugangsschlüssel ist eingerichtet."
                : "Noch kein Zugangsschlüssel eingerichtet."}
          </p>
          {status?.configured && status.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Zuletzt erzeugt: {new Date(status.updatedAt).toLocaleString("de-DE")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Der Schlüssel selbst wird nie angezeigt — er steckt fertig eingetragen in der
            heruntergeladenen Erweiterung. Jeder Download erzeugt einen neuen Schlüssel;
            eine früher installierte Erweiterung verliert dann ihren Zugang.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleDownload} disabled={isWorking}>
            {isWorking ? "Wird erzeugt…" : "Erweiterung herunterladen (.mcpb)"}
          </Button>
          {status?.configured && (
            <Button variant="outline" onClick={handleRevoke} disabled={isWorking}>
              Schlüssel widerrufen
            </Button>
          )}
        </div>

        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="font-medium">So installierst du die Erweiterung in Claude:</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Datei herunterladen (Knopf oben) — sie heißt <code>knowledgescout.mcpb</code>.</li>
            <li>Claude-Desktop-App öffnen: Einstellungen → Erweiterungen.</li>
            <li>
              <strong>„Erweiterung installieren“</strong> wählen und die heruntergeladene
              Datei auswählen (oder die Datei ins Fenster ziehen).
            </li>
            <li>Fertig — Server-Adresse und Schlüssel sind schon eingetragen.</li>
            <li>
              Nach einem erneuten Download: alte Erweiterung entfernen und die neue Datei
              installieren (der alte Schlüssel ist dann ungültig).
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Bei Verbindungsproblemen: Erweiterung einmal aus- und wieder einschalten;
            Diagnose im Log <code>%APPDATA%\Claude\logs\mcp-server-KnowledgeScout.log</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
