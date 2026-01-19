"use client"

import * as React from "react"
import { useAtomValue } from "jotai"

import { IngestionBookDetail } from "@/components/library/ingestion-book-detail"
import { IngestionSessionDetail } from "@/components/library/ingestion-session-detail"
import { librariesAtom } from "@/atoms/library-atom"
import { getDetailViewType } from "@/lib/templates/detail-view-type-utils"

interface IngestionDetailPanelProps {
  libraryId: string
  fileId: string
}

interface DocMetaResponse {
  docMetaJson?: Record<string, unknown>
}

export function IngestionDetailPanel({ libraryId, fileId }: IngestionDetailPanelProps) {
  const libraries = useAtomValue(librariesAtom)
  const activeLibrary = libraries.find((lib) => lib.id === libraryId)
  const libraryConfig = activeLibrary?.config?.chat

  const [meta, setMeta] = React.useState<Record<string, unknown>>({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!libraryId || !fileId) return
      try {
        setLoading(true)
        setError(null)
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
        const res = await fetch(url, { cache: "no-store" })
        const json = (await res.json()) as DocMetaResponse
        if (!res.ok) {
          const msg = typeof (json as { error?: unknown })?.error === "string"
            ? (json as { error: string }).error
            : "Dokument-Metadaten konnten nicht geladen werden"
          throw new Error(msg)
        }
        if (cancelled) return
        setMeta(json?.docMetaJson && typeof json.docMetaJson === "object" ? json.docMetaJson : {})
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [libraryId, fileId])

  const viewType = React.useMemo(() => getDetailViewType(meta, libraryConfig), [meta, libraryConfig])
  const hasMeta = React.useMemo(() => Object.keys(meta).length > 0, [meta])

  if (loading) return <div className="text-sm text-muted-foreground">Lade Story-Daten…</div>
  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (!hasMeta) {
    return (
      <div className="text-sm text-muted-foreground">
        Keine Ingestion Daten vorhanden – es wurde noch nichts publiziert.
      </div>
    )
  }

  // Story-Ansicht soll die kanonische Ingestion-Sicht zeigen (wie in der Gallery).
  if (viewType === "session") {
    return <IngestionSessionDetail libraryId={libraryId} fileId={fileId} />
  }

  return <IngestionBookDetail libraryId={libraryId} fileId={fileId} />
}

