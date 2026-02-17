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
 *
 * WICHTIG: Wenn die angeforderte Sprache nicht existiert, wird auf die erste
 * verfuegbare Sprache zurueckgefallen. Sonst wuerde z.B. ein englisches
 * Transkript (transcript.en) nicht angezeigt, wenn die UI targetLanguage 'de' erwartet.
 */
export function selectShadowTwinArtifact(
  doc: ShadowTwinDocument,
  preferredKind: ArtifactKind,
  targetLanguage: string
): SelectedShadowTwinArtifact | null {
  if (preferredKind === 'transcript') {
    const transcriptByLang = doc.artifacts.transcript
    if (!transcriptByLang || typeof transcriptByLang !== 'object') return null
    const entries = Object.entries(transcriptByLang)
    if (entries.length === 0) return null
    // Bevorzugt angeforderte Sprache, sonst erste verfuegbare (z.B. transcript.en wenn nur en existiert)
    const preferred = entries.find(([lang]) => lang === targetLanguage)
    const [actualLang, record] = preferred ?? entries[0]
    return { kind: 'transcript', targetLanguage: actualLang, record }
  }

  const transformations = doc.artifacts.transformation || {}
  let best: SelectedShadowTwinArtifact | null = null
  for (const [templateName, langs] of Object.entries(transformations)) {
    if (!langs || typeof langs !== 'object') continue
    const langEntries = Object.entries(langs)
    if (langEntries.length === 0) continue
    // Bevorzugt angeforderte Sprache, sonst erste verfuegbare
    const preferred = langEntries.find(([lang]) => lang === targetLanguage)
    const [actualLang, record] = preferred ?? langEntries[0]
    if (!best) {
      best = { kind: 'transformation', targetLanguage: actualLang, templateName, record }
      continue
    }
    if (record.updatedAt > best.record.updatedAt) {
      best = { kind: 'transformation', targetLanguage: actualLang, templateName, record }
    }
  }
  return best
}
