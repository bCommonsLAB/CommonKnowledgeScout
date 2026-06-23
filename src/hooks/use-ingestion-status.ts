'use client'

/**
 * @fileoverview Geteilter Query-Hook fuer den Ingestion-Status EINER Datei.
 *
 * @description
 * Mehrere Stellen brauchen denselben Ingestion-Status (Tab-Status via use-story-status,
 * Story-View/Compact via IngestionDataProvider, Detail-Tabelle). Frueher hatte jede ihren
 * EIGENEN Lade-/Cache-Mechanismus (Context, TTL-Map, lokaler State) — pro Datei-Oeffnen
 * mehrfach (Re-Trace R2: ingestion-status 2x). Ein gemeinsamer queryKey pro
 * (Library, Datei, Variante) dedupliziert das ueber den React-Query-Cache.
 *
 * Zwei Varianten: `compact` (nur Doc+Stats, schnell) und `full` (inkl. Kapitel, schwerer).
 * Sie sind getrennte Keys, damit leichte Status-Badges nicht auf den schweren Voll-Call warten.
 *
 * @module hooks
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface IngestionStatusChapter {
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
}

export interface IngestionStatusResponse {
  indexExists: boolean
  doc: {
    exists: boolean
    status: 'ok' | 'stale' | 'not_indexed'
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
  chapters: IngestionStatusChapter[]
}

export interface UseIngestionStatusOptions {
  /** true → Kapitel mitladen (schwerer Voll-Call); false → compact. Default false. */
  includeChapters?: boolean
  /** Dokument-Modifikationsdatum fuer den Staleness-Check (Teil des queryKey). */
  docModifiedAt?: string
  /** Zusaetzliche Aktivierungsbedingung (UND mit libraryId/fileId vorhanden). */
  enabled?: boolean
}

/** Stabiler queryKey pro (Library, Datei, Variante, docModifiedAt) — Basis der Dedup. */
export function ingestionStatusQueryKey(
  libraryId: string,
  fileId: string,
  includeChapters: boolean,
  docModifiedAt: string
) {
  return ['ingestion-status', libraryId, fileId, includeChapters ? 'full' : 'compact', docModifiedAt] as const
}

async function fetchIngestionStatus(
  libraryId: string,
  fileId: string,
  includeChapters: boolean,
  docModifiedAt: string
): Promise<IngestionStatusResponse> {
  const params = new URLSearchParams({ fileId })
  if (docModifiedAt) params.set('docModifiedAt', docModifiedAt)
  if (includeChapters) params.set('includeChapters', 'true')
  else params.set('compact', '1')

  const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/ingestion-status?${params.toString()}`, {
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => null)) as (IngestionStatusResponse & { error?: string }) | null
  if (!res.ok) {
    throw new Error(json && typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
  }
  return json as IngestionStatusResponse
}

/**
 * Laedt den Ingestion-Status einer Datei (geteilt + dedupliziert). Ist eine der IDs leer
 * (oder `enabled: false`), bleibt die Query disabled und liefert `undefined`.
 */
export function useIngestionStatus(
  libraryId: string | undefined,
  fileId: string | undefined,
  opts?: UseIngestionStatusOptions
) {
  const includeChapters = opts?.includeChapters ?? false
  const docModifiedAt = opts?.docModifiedAt ?? ''
  return useQuery({
    queryKey: ingestionStatusQueryKey(libraryId ?? '', fileId ?? '', includeChapters, docModifiedAt),
    enabled: Boolean(libraryId && fileId) && (opts?.enabled ?? true),
    queryFn: () => fetchIngestionStatus(libraryId as string, fileId as string, includeChapters, docModifiedAt),
  })
}

/**
 * Invalidiert beide Varianten (compact + full) einer Datei → erzwingt frisches Laden bei
 * allen Consumern. Nach Job-Abschluss/Re-Analyse aufrufen (queryKey-Prefix-Match).
 */
export function useInvalidateIngestionStatus() {
  const queryClient = useQueryClient()
  return (libraryId: string, fileId: string) =>
    queryClient.invalidateQueries({ queryKey: ['ingestion-status', libraryId, fileId] })
}
