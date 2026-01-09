"use client"

import * as React from "react"

/**
 * Gemeinsamer Hook für Ingestion-Daten (MongoDB).
 * Wird von Story View und Story Info verwendet, um doppelte API-Calls zu vermeiden.
 * 
 * Die Daten kommen aus der ingestion-status API (mit chapters, wenn nicht compact).
 */
interface IngestionData {
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
    authors?: string[]
    year?: number | string
    pages?: number
    region?: string
    docType?: string
    source?: string
    issue?: string | number
    language?: string
    topics?: string[]
    summary?: string
  }
  chapters: Array<{
    chapterId: string
    title?: string
    order?: number
    level?: number
    startChunk?: number
    endChunk?: number
    chunkCount?: number
    startPage?: number
    endPage?: number
    pageCount?: number
    summary?: string
    keywords?: string[]
    upsertedAt?: string
  }>
}

interface UseIngestionDataResult {
  data: IngestionData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Lädt Ingestion-Daten aus MongoDB (via ingestion-status API).
 * 
 * @param libraryId - Library ID
 * @param fileId - File ID
 * @param docModifiedAt - Optional: Dokument-Modifikationsdatum für Staleness-Check
 * @param includeChapters - Wenn true, werden auch Kapitel geladen (für Story View). Default: false (kompakt für Info)
 */
export function useIngestionData(
  libraryId: string,
  fileId: string,
  docModifiedAt?: string,
  includeChapters = false
): UseIngestionDataResult {
  const [data, setData] = React.useState<IngestionData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set("fileId", fileId)
      if (docModifiedAt) {
        params.set("docModifiedAt", docModifiedAt)
      }
      // Wenn chapters benötigt werden, nicht compact verwenden
      if (includeChapters) {
        params.set("includeChapters", "true")
      } else {
        params.set("compact", "1")
      }

      const res = await fetch(
        `/api/chat/${encodeURIComponent(libraryId)}/ingestion-status?${params.toString()}`,
        { cache: "no-store" }
      )
      const json = await res.json()
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Ingestion-Status konnte nicht geladen werden")
      }
      setData(json as IngestionData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler")
    } finally {
      setLoading(false)
    }
  }, [libraryId, fileId, docModifiedAt, includeChapters])

  React.useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, refetch: load }
}

