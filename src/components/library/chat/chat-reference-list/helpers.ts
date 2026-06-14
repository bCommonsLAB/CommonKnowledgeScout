/**
 * Pure-Helper fuer ChatReferenceList (Welle 3-III-b).
 *
 * Extrahiert aus chat-reference-list.tsx:
 * - extractSourceType  — Quell-Typ aus Beschreibungstext
 * - getSourceTypeLabel — Lesbares Label fuer Quell-Typ
 * - groupReferencesByFileId — Gruppiert Referenzen nach Dokument
 *
 * Alle Funktionen sind seiteneffektfrei und deterministisch (testbar!).
 */

import type { ChatResponse } from '@/types/chat-response'

/** Extrahiert den Quell-Typ aus dem Beschreibungstext einer Referenz */
export function extractSourceType(description: string): string | undefined {
  if (description.includes('Slide-Seite') || description.includes('Slide page')) return 'slides'
  if (description.includes('Videotranskript') || description.includes('Video transcript')) return 'video_transcript'
  if (description.includes('Markdown-Body') || description.includes('Markdown body')) return 'body'
  if (description.includes('Kapitel') || description.includes('Chapter')) return 'chapter'
  return undefined
}

/** Gibt ein lesbares Label fuer einen Quell-Typ zurueck */
export function getSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'slides':
      return 'Slides'
    case 'body':
      return 'Markdown-Body'
    case 'video_transcript':
      return 'Video-Transkript'
    case 'chapter':
      return 'Kapitel'
    default:
      return sourceType
  }
}

/** Gruppiete Referenz-Eintraege nach fileId mit Source-Gruppen */
export interface GroupedReference {
  fileName?: string
  fileId: string
  /** Inhaltstyp des Dokuments (A4) — aus der ersten Referenz mit Typ. */
  detailViewType?: string
  sourceGroups: Map<string, { sourceType: string; references: ChatResponse['references'] }>
  references: ChatResponse['references']
}

/**
 * Gruppiert Referenzen nach fileId, dann nach sourceType.
 *
 * @param refs - Flache Referenz-Liste aus der Chat-Response
 * @returns Gruppierte Liste, eine Eintraege pro Dokument
 */
export function groupReferencesByFileId(refs: ChatResponse['references']): GroupedReference[] {
  const map = new Map<string, GroupedReference>()

  for (const ref of refs) {
    const existing = map.get(ref.fileId)
    const sourceType = extractSourceType(ref.description) || 'unknown'

    if (existing) {
      // Fuege Referenz zu vorhandener sourceGroup hinzu
      const sourceGroup = existing.sourceGroups.get(sourceType)
      if (sourceGroup) {
        sourceGroup.references.push(ref)
      } else {
        existing.sourceGroups.set(sourceType, {
          sourceType,
          references: [ref],
        })
      }
      existing.references.push(ref)
      // Aktualisiere fileName falls vorhanden aber noch leer
      if (ref.fileName && !existing.fileName) {
        existing.fileName = ref.fileName
      }
      // detailViewType aus der ersten Referenz uebernehmen, die einen traegt.
      if (ref.detailViewType && !existing.detailViewType) {
        existing.detailViewType = ref.detailViewType
      }
    } else {
      const sourceGroups = new Map<string, { sourceType: string; references: ChatResponse['references'] }>()
      sourceGroups.set(sourceType, {
        sourceType,
        references: [ref],
      })
      map.set(ref.fileId, {
        fileId: ref.fileId,
        fileName: ref.fileName,
        detailViewType: ref.detailViewType,
        sourceGroups,
        references: [ref],
      })
    }
  }

  return Array.from(map.values())
}
