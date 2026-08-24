'use client'

/**
 * @fileoverview Artefakt-Inhalt fuer die Detail-Tabs (Welle A3).
 *
 * @description
 * Laedt das Markdown eines Twin-Artefakts (Transkript bzw. Zusammenfassung)
 * ueber die BESTEHENDE Shadow-Twin-Content-Route (Mongo) — die Agentensicht
 * bekommt keinen eigenen Lesepfad. 404 ist ein benannter Domaenenzustand
 * (Artefakt nicht in MongoDB — z. B. nie importiert), kein stummer Leerlauf.
 *
 * @module hooks/agent-view
 */

import { useQuery } from '@tanstack/react-query'
import type { LeadingArtifactSummary } from '@/lib/agent-view/types'

export interface ArtefaktInhalt {
  markdown: string | null
  /** Benannter Grund, wenn kein Markdown kommt. */
  grund: 'nicht_in_mongo' | null
}

async function fetchInhalt(
  libraryId: string,
  sourceId: string,
  artefakt: Pick<LeadingArtifactSummary, 'kind' | 'templateName' | 'targetLanguage'>,
): Promise<ArtefaktInhalt> {
  const params = new URLSearchParams({ sourceId, kind: artefakt.kind, targetLanguage: artefakt.targetLanguage })
  if (artefakt.templateName !== null) params.set('templateName', artefakt.templateName)
  const response = await fetch(
    `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/content?${params.toString()}`,
  )
  if (response.status === 404) return { markdown: null, grund: 'nicht_in_mongo' }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Content-Route antwortete ${response.status}`)
  }
  const body = (await response.json()) as { markdown: string }
  return { markdown: body.markdown, grund: null }
}

/** Laedt den Inhalt des Artefakts; `artefakt: null` laedt nichts. */
export function useArtefaktInhalt(
  libraryId: string,
  sourceId: string,
  artefakt: Pick<LeadingArtifactSummary, 'kind' | 'templateName' | 'targetLanguage'> | null,
) {
  return useQuery({
    queryKey: ['agent-view-artefakt', libraryId, sourceId, artefakt?.kind, artefakt?.templateName, artefakt?.targetLanguage],
    queryFn: () => fetchInhalt(libraryId, sourceId, artefakt as NonNullable<typeof artefakt>),
    enabled: artefakt !== null,
    staleTime: 30_000,
    retry: 1,
  })
}
