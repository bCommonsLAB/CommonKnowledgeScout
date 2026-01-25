/**
 * @fileoverview Shadow-Twin Mongo Client (Frontend)
 *
 * @description
 * Kleiner Client-Wrapper fuer das Laden und Speichern von Mongo-Shadow-Twins.
 */

import type { MongoShadowTwinIdParts } from '@/lib/shadow-twin/mongo-shadow-twin-id'

export async function fetchShadowTwinMarkdown(
  libraryId: string,
  parts: MongoShadowTwinIdParts
): Promise<string> {
  const params = new URLSearchParams({
    sourceId: parts.sourceId,
    kind: parts.kind,
    targetLanguage: parts.targetLanguage,
  })
  if (parts.templateName) params.set('templateName', parts.templateName)

  const res = await fetch(`/api/library/${libraryId}/shadow-twins/content?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  const data = (await res.json()) as { markdown?: string }
  return data.markdown || ''
}

export async function updateShadowTwinMarkdown(
  libraryId: string,
  parts: MongoShadowTwinIdParts,
  markdown: string
): Promise<void> {
  const res = await fetch(`/api/library/${libraryId}/shadow-twins/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceId: parts.sourceId,
      kind: parts.kind,
      targetLanguage: parts.targetLanguage,
      templateName: parts.templateName,
      markdown,
    }),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
}
