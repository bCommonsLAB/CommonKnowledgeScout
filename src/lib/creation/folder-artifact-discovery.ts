/**
 * @fileoverview Folder-Artifact-Discovery für Creation Wizard
 *
 * @description
 * Entdeckt alle transkribierten Artefakte in einem Verzeichnis.
 * Für Audio, Video, PDF, Office: lädt Transcript aus Shadow-Twin.
 * Für Markdown/Text: lädt Inhalt direkt.
 *
 * Zwei Modi:
 * - discoverFolderArtifactsViaApi: Nutzt API-Route (empfohlen). Unterstützt MongoDB + Filesystem.
 * - discoverFolderArtifacts: Client-seitig mit Provider. Findet nur Filesystem-Artefakte.
 *
 * @module creation
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { WizardSource } from '@/lib/creation/corpus'
import { getMediaKind } from '@/lib/media-types'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'

/** Medientypen, die als Quellen verwendet werden können (mit Transcript oder direktem Inhalt) */
const SUPPORTED_MEDIA_KINDS = new Set<string>([
  'pdf',
  'audio',
  'video',
  'docx',
  'xlsx',
  'pptx',
  'markdown',
])

/**
 * Entdeckt alle Artefakte mit extrahierbarem Text in einem Verzeichnis.
 *
 * @param provider Storage-Provider
 * @param folderId ID des Verzeichnisses
 * @param targetLanguage Zielsprache für Transcript-Suche (Default: 'de')
 * @returns WizardSource[] – Quellen mit extractedText für Korpus
 */
export async function discoverFolderArtifacts(
  provider: StorageProvider,
  folderId: string,
  targetLanguage: string = 'de'
): Promise<WizardSource[]> {
  const items = await provider.listItemsById(folderId)
  const sources: WizardSource[] = []

  for (const item of items) {
    if (item.type !== 'file') continue

    const kind = getMediaKind(item)
    if (!SUPPORTED_MEDIA_KINDS.has(kind)) continue

    const fileName = item.metadata?.name || 'unbekannt'
    const parentId = item.parentId || folderId

    let extractedText = ''
    let summary = ''

    try {
      if (kind === 'markdown') {
        // Markdown/Text: Inhalt direkt laden, Frontmatter entfernen
        const { blob } = await provider.getBinary(item.id)
        const raw = await blob.text()
        extractedText = stripAllFrontmatter(raw).trim()
        summary = extractedText.length > 150 ? `${extractedText.slice(0, 150)}...` : extractedText
      } else {
        // PDF, Audio, Video, Office: Transcript aus Shadow-Twin laden
        const resolved = await resolveArtifact(provider, {
          sourceItemId: item.id,
          sourceName: fileName,
          parentId,
          targetLanguage,
          preferredKind: 'transcript',
        })

        if (resolved?.fileId) {
          const { blob } = await provider.getBinary(resolved.fileId)
          const raw = await blob.text()
          extractedText = stripAllFrontmatter(raw).trim()
          summary = extractedText.length > 150 ? `${extractedText.slice(0, 150)}...` : extractedText
        }
      }

      if (!extractedText.trim()) continue

      const modifiedAt = item.metadata?.modifiedAt
      const createdAt = modifiedAt instanceof Date
        ? modifiedAt
        : typeof modifiedAt === 'string'
          ? new Date(modifiedAt)
          : new Date()

      sources.push({
        id: `file-${item.id}`,
        kind: 'file',
        fileName,
        extractedText,
        summary: summary || fileName,
        createdAt,
      })
    } catch (err) {
      console.warn(`[folder-artifact-discovery] Überspringe ${fileName}:`, err)
    }
  }

  // Chronologisch sortieren (älteste zuerst). createdAt kann Date oder ISO-String sein.
  const toTs = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime()
  sources.sort((a, b) => toTs(a.createdAt) - toTs(b.createdAt))

  return sources
}

/**
 * Entdeckt Artefakte über die API-Route (serverseitig).
 * Unterstützt sowohl MongoDB- als auch Filesystem-basierte Shadow-Twins.
 *
 * @param libraryId Library-ID
 * @param folderId ID des Verzeichnisses
 * @param targetLanguage Zielsprache (Default: 'de')
 * @returns WizardSource[]
 */
export async function discoverFolderArtifactsViaApi(
  libraryId: string,
  folderId: string,
  targetLanguage: string = 'de'
): Promise<WizardSource[]> {
  const response = await fetch(`/api/library/${libraryId}/artifacts/folder-discovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId, targetLanguage }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(
      (errData.error as string) || `Folder-Discovery fehlgeschlagen: ${response.status}`
    )
  }

  const data = (await response.json()) as { sources: WizardSource[] }
  return data.sources || []
}
