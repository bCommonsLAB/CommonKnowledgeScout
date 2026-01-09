"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { useIngestionDataContext } from "./ingestion-data-context"

interface IngestionStatusData {
  indexExists: boolean
  doc: {
    exists: boolean
    status: "ok" | "stale" | "not_indexed"
    fileName?: string
    title?: string
    user?: string
    chunkCount?: number
    chaptersCount?: number
    upsertedAt?: string
    docModifiedAt?: string
  }
}

function formatShortIso(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString("de-DE", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function IngestionStatusCompact({
  libraryId,
  fileId,
  docModifiedAt,
}: {
  libraryId: string
  fileId: string
  docModifiedAt?: string
}) {
  // Versuche Context zu verwenden (wenn innerhalb von IngestionDataProvider)
  let contextData: IngestionStatusData | null = null
  let contextLoading = false
  let contextError: string | null = null
  let contextRefetch: (() => Promise<void>) | null = null

  try {
    const ctx = useIngestionDataContext()
    contextData = ctx.data
    contextLoading = ctx.loading
    contextError = ctx.error
    contextRefetch = ctx.refetch
  } catch {
    // Context nicht verfügbar, verwende lokalen State
  }

  const [data, setData] = React.useState<IngestionStatusData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(
        `/api/chat/${encodeURIComponent(libraryId)}/ingestion-status?fileId=${encodeURIComponent(fileId)}&compact=1${
          docModifiedAt ? `&docModifiedAt=${encodeURIComponent(docModifiedAt)}` : ""
        }`,
        { cache: "no-store" }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Ingestion-Status konnte nicht geladen werden")
      setData(json as IngestionStatusData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler")
    } finally {
      setLoading(false)
    }
  }, [libraryId, fileId, docModifiedAt])

  // Verwende Context-Daten, wenn verfügbar, sonst lokalen State
  const finalData = contextData || data
  const finalLoading = contextLoading || loading
  const finalError = contextError || error
  const finalRefetch = contextRefetch || load

  // Nur laden, wenn Context nicht verfügbar
  React.useEffect(() => {
    if (!contextData && !contextLoading) {
      void load()
    }
  }, [load, contextData, contextLoading])

  if (finalLoading && !finalData) return <div className="text-sm text-muted-foreground">Lade Ingestion…</div>
  if (finalError) return <div className="text-sm text-destructive">{finalError}</div>
  if (!finalData) return null

  const title = finalData.doc.title || finalData.doc.fileName || "—"
  const chunks = finalData.doc.chunkCount ?? "—"
  const chapters = finalData.doc.chaptersCount ?? "—"
  const user = finalData.doc.user || "—"
  const upserted = formatShortIso(finalData.doc.upsertedAt)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Index {finalData.indexExists ? "vorhanden" : "nicht vorhanden"} · Doc {finalData.doc.exists ? "vorhanden" : "nicht vorhanden"} · {finalData.doc.status}
        </div>
        <button className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs" onClick={() => void finalRefetch()}>
          Aktualisieren
        </button>
      </div>

      {finalData.doc.exists ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-xs text-muted-foreground">
              Titel: {title} - Chunks: {chunks} · Kapitel: {chapters}
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">{upserted}</div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-xs text-muted-foreground">Nutzer: {user}</div>
            <div className="shrink-0" />
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Kein Ingestion-Dokument gefunden.</div>
      )}
    </div>
  )
}


