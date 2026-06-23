'use client'

/**
 * @fileoverview Geteilter Query-Hook fuer die Shadow-Twin-Artefakte EINER Quelle.
 *
 * @description
 * Mehrere Komponenten (Datei-Vorschau, Artefakt-Info-Panel) brauchen beim
 * Datei-Oeffnen dieselbe Liste aller Artefakte (alle Sprachen/Templates). Frueher
 * holte jede Komponente sie unabhaengig per fetch in einem eigenen Effect — pro
 * Oeffnen mehrfach (Re-Trace R2: derselbe Shadow-Twin 3x geladen). Ein gemeinsamer
 * queryKey dedupliziert das ueber den React-Query-Cache; Aktualitaet wird gezielt
 * ueber Invalidierung gesteuert (z.B. nach Job-Ende oder Loeschen).
 *
 * @module hooks
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'

/** UI-DTO eines Mongo-Shadow-Twin-Artefakts (Form der GET /shadow-twins/<id>-Antwort). */
export interface SourceArtifactDto {
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  updatedAt: string
  createdAt: string
  markdownLength: number
}

/** Stabiler queryKey pro (Library, Quelle) — Basis der komponentenuebergreifenden Dedup. */
export function sourceArtifactsQueryKey(libraryId: string, sourceId: string) {
  return ['shadow-twin-artifacts', libraryId, sourceId] as const
}

async function fetchSourceArtifacts(libraryId: string, sourceId: string): Promise<SourceArtifactDto[]> {
  const res = await fetch(
    `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/${encodeURIComponent(sourceId)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status} beim Laden der Artefakte`)
  const data = (await res.json()) as { artifacts?: SourceArtifactDto[] }
  return data.artifacts ?? []
}

/**
 * Laedt alle Artefakte einer Quelle (geteilt + dedupliziert). Ist eine der IDs leer,
 * bleibt die Query disabled und liefert `undefined` (kein Fetch).
 */
export function useSourceArtifacts(libraryId: string | undefined, sourceId: string | undefined) {
  return useQuery({
    queryKey: sourceArtifactsQueryKey(libraryId ?? '', sourceId ?? ''),
    enabled: Boolean(libraryId && sourceId),
    queryFn: () => fetchSourceArtifacts(libraryId as string, sourceId as string),
  })
}

/**
 * Liefert eine Funktion, die den geteilten Cache fuer eine Quelle invalidiert
 * (erzwingt frisches Laden bei allen Consumern). Nach Job-Ende/Loeschen aufrufen.
 */
export function useInvalidateSourceArtifacts() {
  const queryClient = useQueryClient()
  return (libraryId: string, sourceId: string) =>
    queryClient.invalidateQueries({ queryKey: sourceArtifactsQueryKey(libraryId, sourceId) })
}
