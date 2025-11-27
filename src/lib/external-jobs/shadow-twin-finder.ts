/**
 * @fileoverview Shadow-Twin-Markdown-Datei-Suche
 *
 * @description
 * Konsolidiert die wiederholte Logik zur Suche nach Shadow-Twin-Markdown-Dateien.
 * Sucht zuerst im Shadow-Twin-Verzeichnis, dann im Parent-Verzeichnis (Fallback).
 *
 * @module external-jobs
 */

import type { StorageProvider } from '@/lib/storage/types'
import { findShadowTwinFolder, findShadowTwinMarkdown } from '@/lib/storage/shadow-twin'

/**
 * Findet eine Shadow-Twin-Markdown-Datei.
 *
 * Sucht zuerst im Shadow-Twin-Verzeichnis (falls vorhanden), dann im Parent-Verzeichnis.
 *
 * @param parentId ID des Parent-Verzeichnisses
 * @param baseName Basisname der Originaldatei (ohne Extension)
 * @param lang Zielsprache
 * @param originalName Vollständiger Name der Originaldatei (für Shadow-Twin-Verzeichnis-Suche)
 * @param provider Storage-Provider
 * @returns Gefundene Markdown-Datei oder null
 */
export async function findShadowTwinMarkdownFile(
  parentId: string,
  baseName: string,
  lang: string,
  originalName: string,
  provider: StorageProvider
): Promise<{ id: string } | null> {
  // 1. Prüfe auf Shadow-Twin-Verzeichnis
  const shadowTwinFolder = await findShadowTwinFolder(parentId, originalName, provider)
  if (shadowTwinFolder) {
    // Markdown-Datei im Verzeichnis finden
    const markdownInFolder = await findShadowTwinMarkdown(shadowTwinFolder.id, baseName, lang, provider)
    if (markdownInFolder) {
      return { id: markdownInFolder.id }
    }
  }

  // 2. Wenn kein Verzeichnis gefunden: Shadow-Twin-Datei wie bisher suchen
  const twinName = `${baseName}.${lang}.md`
  const siblings = await provider.listItemsById(parentId)
  const twin = siblings.find(
    it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === twinName
  ) as { id: string } | undefined

  return twin || null
}





