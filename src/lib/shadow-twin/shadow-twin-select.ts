/**
 * @fileoverview Shadow-Twin Artifact Selection
 *
 * @description
 * Waehlt das passende Artefakt aus einem Shadow-Twin-Dokument aus.
 * Fokus: deterministische Auswahl pro Sprache.
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import type { ShadowTwinArtifactRecord, ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'

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
 * Transkripte sind sprach-neutral (ein Record pro Quelle = Originalsprache); targetLanguage
 * ist hier irrelevant. Fuer Transformationen gilt EXAKTER Sprach-Match: existiert die
 * angeforderte Sprache nicht, wird `null` zurueckgegeben — KEIN stiller Cross-Sprach-Fallback
 * (siehe no-silent-fallbacks.mdc). Unter mehreren Templates derselben Sprache gewinnt das
 * neueste (`updatedAt`); die Template-Wahl ist hier bewusst agnostisch (Aufrufer mit bekanntem
 * Template adressieren das Artefakt direkt ueber `getShadowTwinArtifact`).
 */
export function selectShadowTwinArtifact(
  doc: ShadowTwinDocument,
  preferredKind: ArtifactKind,
  targetLanguage: string
): SelectedShadowTwinArtifact | null {
  if (preferredKind === 'transcript') {
    // Sprach-neutral: genau ein Transkript-Record (Helper toleriert Legacy-Map).
    const record = readTranscriptRecord(doc)
    if (!record) return null
    // Leerer targetLanguage: das Transkript hat keine Zielsprache (Originalsprache des Dokuments).
    return { kind: 'transcript', targetLanguage: '', record }
  }

  const transformations = doc.artifacts.transformation || {}
  let best: SelectedShadowTwinArtifact | null = null
  for (const [templateName, langs] of Object.entries(transformations)) {
    if (!langs || typeof langs !== 'object') continue
    const langEntries = Object.entries(langs) as Array<[string, ShadowTwinArtifactRecord]>
    // Exakter Sprach-Match: Templates ohne die angeforderte Sprache werden uebersprungen.
    // KEIN stiller Fallback auf eine andere Sprache (no-silent-fallbacks.mdc).
    const match = langEntries.find(([lang]) => lang === targetLanguage)
    if (!match) continue
    const record = match[1]
    if (!best || record.updatedAt > best.record.updatedAt) {
      best = { kind: 'transformation', targetLanguage, templateName, record }
    }
  }
  return best
}
