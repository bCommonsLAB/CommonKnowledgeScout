"use client"

import * as React from "react"
import { useAtomValue } from "jotai"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import {
  useIngestionStatus,
  useInvalidateIngestionStatus,
  type IngestionStatusResponse,
} from "@/hooks/use-ingestion-status"

/**
 * Gemeinsamer Hook für Ingestion-Daten (MongoDB).
 * Wird von Story View und Story Info verwendet, um doppelte API-Calls zu vermeiden.
 *
 * Backing: geteilter React-Query-Cache (`useIngestionStatus`) — dadurch teilen sich ALLE
 * Consumer derselben (Datei, Variante) EINEN Request, nicht mehr nur innerhalb eines
 * Context-Providers (Re-Trace R2: ingestion-status mehrfach pro Öffnen).
 *
 * Die Daten kommen aus der ingestion-status API (mit chapters, wenn nicht compact).
 */
export interface IngestionData {
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
    docMetaJson?: unknown
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
 * Lädt Ingestion-Daten aus MongoDB (via geteiltem ingestion-status-Query).
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
  // Trigger-Atom abonnieren, um bei Job-Abschluss neu zu laden
  const shadowTwinTrigger = useAtomValue(shadowTwinAnalysisTriggerAtom)
  const invalidate = useInvalidateIngestionStatus()

  const query = useIngestionStatus(libraryId, fileId, { includeChapters, docModifiedAt })

  // Bei Job-Abschluss neu laden — nur beim echten WECHSEL des Trigger-Werts (nicht initial,
  // sonst unnötiges Refetch direkt nach dem Mount).
  const prevTrigger = React.useRef(shadowTwinTrigger)
  React.useEffect(() => {
    if (prevTrigger.current !== shadowTwinTrigger) {
      prevTrigger.current = shadowTwinTrigger
      if (libraryId && fileId) void invalidate(libraryId, fileId)
    }
  }, [shadowTwinTrigger, libraryId, fileId, invalidate])

  const refetch = React.useCallback(async () => {
    if (libraryId && fileId) await invalidate(libraryId, fileId)
  }, [invalidate, libraryId, fileId])

  return {
    // IngestionStatusResponse ist strukturell ein IngestionData (docMetaJson nur optional ergänzt).
    data: (query.data as IngestionStatusResponse | undefined) ? (query.data as unknown as IngestionData) : null,
    loading: query.isFetching,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    refetch,
  }
}
