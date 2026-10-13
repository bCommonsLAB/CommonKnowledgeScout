"use client"

/**
 * Zustand und Aktionen der Konto-Seite „Speicher-Verbindungen" (Plan Teil A, A1).
 * Spricht nur mit `/api/account/storage-connections/**`; Antworten sind
 * Zusammenfassungen ohne Geheimnisse.
 */

import { useCallback, useEffect, useState } from "react"
import { toast } from '@ks/ui'
import type { StorageConnectionInput, StorageConnectionSummary } from "@/types/storage-connection"

const BASE = "/api/account/storage-connections"

async function lesen<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})

const nachLabel = (a: StorageConnectionSummary, b: StorageConnectionSummary) => a.label.localeCompare(b.label, "de")

export function useStorageConnections() {
  const [connections, setConnections] = useState<StorageConnectionSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const data = await lesen<{ connections: StorageConnectionSummary[] }>(await fetch(BASE))
      setConnections(data.connections)
      setLoadError(null)
    } catch (error) {
      console.error("[StorageConnections] Liste konnte nicht geladen werden:", error)
      setLoadError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const ersetze = useCallback((summary: StorageConnectionSummary) => {
    setConnections((prev) => (prev ?? []).map((c) => (c.id === summary.id ? summary : c)).sort(nachLabel))
  }, [])

  /** Anlegen/Aendern werfen bei Fehlern — der Dialog zeigt die Meldung am Formular. */
  const create = useCallback(async (input: StorageConnectionInput) => {
    const summary = await lesen<StorageConnectionSummary>(await fetch(BASE, json("POST", input)))
    setConnections((prev) => [...(prev ?? []), summary].sort(nachLabel))
    toast({ title: "Verbindung angelegt", description: `„${summary.label}" ist gespeichert. Jetzt testen.` })
  }, [])

  const update = useCallback(async (id: string, input: StorageConnectionInput) => {
    const summary = await lesen<StorageConnectionSummary>(await fetch(`${BASE}/${id}`, json("PATCH", input)))
    ersetze(summary)
    toast({ title: "Verbindung gespeichert", description: `„${summary.label}" ist aktualisiert.` })
  }, [ersetze])

  /** Aktionen am Datensatz melden Fehler als Toast; `busyId` sperrt die Knopfzeile der Karte. */
  const aktion = useCallback(async (id: string, lauf: () => Promise<void>) => {
    setBusyId(id)
    try {
      await lauf()
    } catch (error) {
      console.error("[StorageConnections] Aktion fehlgeschlagen:", error)
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }, [])

  const remove = useCallback((id: string) => aktion(id, async () => {
    await lesen(await fetch(`${BASE}/${id}`, json("DELETE")))
    setConnections((prev) => (prev ?? []).filter((c) => c.id !== id))
    toast({ title: "Verbindung geloescht" })
  }), [aktion])

  const test = useCallback((id: string) => aktion(id, async () => {
    const summary = await lesen<StorageConnectionSummary>(await fetch(`${BASE}/${id}/test`, json("POST")))
    ersetze(summary)
    const ergebnis = summary.lastTest
    toast({
      title: ergebnis?.ok ? "Verbindung funktioniert" : "Verbindungstest fehlgeschlagen",
      description: ergebnis?.message ?? "Kein Ergebnis.",
      variant: ergebnis?.ok ? undefined : "destructive",
    })
  }), [aktion, ersetze])

  const login = useCallback((id: string) => aktion(id, async () => {
    const { url } = await lesen<{ url: string }>(await fetch(`${BASE}/${id}/onedrive-login`))
    window.location.href = url
  }), [aktion])

  const logout = useCallback((id: string) => aktion(id, async () => {
    ersetze(await lesen<StorageConnectionSummary>(await fetch(`${BASE}/${id}/onedrive-login`, json("DELETE"))))
    toast({ title: "Bei Microsoft abgemeldet" })
  }), [aktion, ersetze])

  return { connections, loadError, busyId, reload, create, update, remove, test, login, logout }
}
