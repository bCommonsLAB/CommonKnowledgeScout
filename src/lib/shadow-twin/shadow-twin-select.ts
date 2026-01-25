/**
 * @fileoverview Shadow-Twin Artifact Selection
 *
 * @description
 * Waehlt das passende Artefakt aus einem Shadow-Twin-Dokument aus.
 * Fokus: deterministische Auswahl pro Sprache.
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import type { ShadowTwinArtifactRecord, ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

export interface SelectedShadowTwinArtifact {
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
  record: ShadowTwinArtifactRecord
}

/**
 * Waehlt ein Artefakt passend zu preferredKind und targetLanguage.
 * Fuer Transformationen wird das neueste Artefakt (updatedAt) pro Sprache genommen.
 */
export function selectShadowTwinArtifact(
  doc: ShadowTwinDocument,
  preferredKind: ArtifactKind,
  targetLanguage: string
): SelectedShadowTwinArtifact | null {
  if (preferredKind === 'transcript') {
    const record = doc.artifacts.transcript?.[targetLanguage]
    if (!record) return null
    return { kind: 'transcript', targetLanguage, record }
  }

  const transformations = doc.artifacts.transformation || {}
  let best: SelectedShadowTwinArtifact | null = null
  for (const [templateName, langs] of Object.entries(transformations)) {
    const record = langs?.[targetLanguage]
    if (!record) continue
    if (!best) {
      best = { kind: 'transformation', targetLanguage, templateName, record }
      continue
    }
    if (record.updatedAt > best.record.updatedAt) {
      best = { kind: 'transformation', targetLanguage, templateName, record }
    }
  }
  return best
}
