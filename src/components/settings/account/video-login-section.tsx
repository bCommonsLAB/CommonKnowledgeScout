"use client"

/**
 * @fileoverview Account-Einstellungen: Video-Anmeldung (Cookie-Datei fuer YouTube & Co., Welle C2).
 *
 * @description
 * YouTube weist Server-Adressen ohne Anmeldung ab. Statt einer Datei auf dem
 * Server hinterlegt jede Person ihre eigene Anmeldung am Konto: die im Browser
 * exportierte `cookies.txt` (Netscape-Format). Der Inhalt wird verschluesselt
 * gespeichert und nur fuer die eigenen Medien-Aufrufe an den Secretary
 * mitgegeben; die Seite zeigt sonst ausschliesslich Status.
 */

import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { Button, Card, CardContent, Textarea } from '@ks/ui'

interface Status {
  hinterlegt: boolean
  zeilen: number
  domains: string[]
  hatYoutube: boolean
  laeuftAbAm: string | null
  abgelaufen: boolean
  aktualisiertAm: string | null
}

export function VideoLoginSection() {
  const [status, setStatus] = useState<Status | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/account/video-login")
      if (!response.ok) throw new Error(`Status-Abruf fehlgeschlagen (HTTP ${response.status})`)
      setStatus((await response.json()) as Status)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setText(await file.text())
      setError(null)
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : String(readError))
    }
  }

  const handleSave = async () => {
    setIsWorking(true)
    setError(null)
    try {
      const response = await fetch("/api/account/video-login", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies: text }),
      })
      const body = (await response.json().catch(() => null)) as (Status & { error?: string }) | null
      if (!response.ok) throw new Error(body?.error ?? `Speichern fehlgeschlagen (HTTP ${response.status})`)
      setText("")
      await loadStatus()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setIsWorking(false)
    }
  }

  const handleDelete = async () => {
    setIsWorking(true)
    setError(null)
    try {
      const response = await fetch("/api/account/video-login", { method: "DELETE" })
      if (!response.ok && response.status !== 404) throw new Error(`Entfernen fehlgeschlagen (HTTP ${response.status})`)
      await loadStatus()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
    } finally {
      setIsWorking(false)
    }
  }

  const statusText = status === null
    ? "Status wird geladen…"
    : !status.hinterlegt
      ? "Keine Video-Anmeldung hinterlegt."
      : status.abgelaufen
        ? "Video-Anmeldung hinterlegt, aber abgelaufen — bitte neu exportieren."
        : "Video-Anmeldung ist hinterlegt."

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Video-Anmeldung (YouTube)</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {'YouTube weist Abrufe von Server-Adressen ohne Anmeldung ab („Sign in to confirm you\'re not a bot"). '}
            Hinterlege hier deine eigene Anmeldung; sie wird nur für deine Abrufe mitgegeben und verschlüsselt gespeichert.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm font-medium">{statusText}</p>
          {status?.hinterlegt && (
            <p className="text-xs text-muted-foreground">
              {status.zeilen} Cookies · {status.domains.join(", ")}
              {status.laeuftAbAm ? ` · gültig bis ${new Date(status.laeuftAbAm).toLocaleDateString("de-DE")}` : ""}
              {status.aktualisiertAm ? ` · hinterlegt am ${new Date(status.aktualisiertAm).toLocaleString("de-DE")}` : ""}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Der Inhalt wird nie angezeigt und nie an den Browser zurückgegeben.</p>
        </div>

        <div className="space-y-2">
          <input type="file" accept=".txt,text/plain" onChange={handleFile} className="text-sm" aria-label="cookies.txt auswählen" />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="# Netscape HTTP Cookie File … (Datei auswählen oder Inhalt hier einfügen)"
            rows={5}
            className="font-mono text-xs"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isWorking || !text.trim()}>
            {isWorking ? "Wird gespeichert…" : status?.hinterlegt ? "Anmeldung ersetzen" : "Anmeldung hinterlegen"}
          </Button>
          {status?.hinterlegt && (
            <Button variant="outline" onClick={handleDelete} disabled={isWorking}>Anmeldung entfernen</Button>
          )}
        </div>

        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="font-medium">So kommst du an die Datei:</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Ein eigenes YouTube-Konto nur für diesen Zweck anlegen — nicht das Hauptkonto (YouTube sperrt Konten, die viel laden).</li>
            <li>{'Damit im Browser bei YouTube anmelden, dann die Erweiterung „Get cookies.txt LOCALLY" öffnen und exportieren.'}</li>
            <li>Die Datei hier auswählen und hinterlegen. Läuft sie ab, erscheint das oben im Status.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
