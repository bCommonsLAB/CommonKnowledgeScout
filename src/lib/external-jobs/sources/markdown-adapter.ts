/**
 * @fileoverview Markdown Source Adapter - Normalisierung von Markdown-Dateien
 *
 * @description
 * Normalisiert Markdown-Dateien zu Canonical Markdown:
 * - Trim Whitespace
 * - Frontmatter erzwingen (falls fehlt: generiere aus Dateiname/Datum)
 * - Body normalisieren (einheitliche Zeilenumbrüche)
 * - Raw Origin: Original-Markdown-Datei als `raw` Artefakt speichern
 *
 * @module external-jobs/sources
 */

import type {
  SourceAdapter,
  SourceInput,
  SourceAdapterOptions,
  CanonicalMarkdownResult,
} from './types'
// StorageProvider wird für zukünftige Erweiterungen importiert
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { StorageProvider } from '@/lib/storage/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Markdown Source Adapter.
 *
 * Normalisiert Markdown-Dateien zu Canonical Markdown mit Frontmatter.
 */
export class MarkdownAdapter implements SourceAdapter {
  async normalize(
    source: SourceInput,
    options?: SourceAdapterOptions
  ): Promise<CanonicalMarkdownResult> {
    if (source.type === 'url') {
      throw new Error('MarkdownAdapter does not support URL sources (use WebsiteAdapter)')
    }

    const storageItem = source as import('@/lib/storage/types').StorageItem
    const provider = options?.provider
    const userEmail = options?.userEmail || ''
    const libraryId = options?.libraryId || ''
    const targetLanguage = options?.targetLanguage || 'de'

    if (!provider) {
      throw new Error('StorageProvider is required for MarkdownAdapter')
    }

    if (!userEmail || !libraryId) {
      throw new Error('userEmail and libraryId are required for MarkdownAdapter')
    }

    // Lade Original-Markdown
    const bin = await provider.getBinary(storageItem.id)
    const originalMarkdown = await bin.blob.text()

    if (!originalMarkdown || originalMarkdown.trim().length === 0) {
      throw new Error('Markdown file is empty')
    }

    // Parse Frontmatter (falls vorhanden)
    const { meta: existingMeta, body: bodyText } = parseFrontmatter(originalMarkdown)

    // Generiere Canonical Meta (Frontmatter verpflichtend)
    const canonicalMeta: Record<string, unknown> = {
      source: storageItem.metadata?.name || storageItem.id,
      title:
        (existingMeta.title as string) ||
        (storageItem.metadata?.name
          ? storageItem.metadata.name.replace(/\.mdx?$/i, '')
          : 'Untitled'),
      date: existingMeta.date || new Date().toISOString(),
      type: 'markdown',
      originRef: `raw:${storageItem.id}`,
      ...existingMeta, // Bestehende Meta-Felder übernehmen
    }

    // Normalisiere Body (einheitliche Zeilenumbrüche, trim)
    const normalizedBody = bodyText.trim().replace(/\r\n/g, '\n')

    // Erzeuge Canonical Markdown mit Frontmatter
    const canonicalMarkdown = createMarkdownWithFrontmatter(normalizedBody, canonicalMeta)

    // Speichere Raw Origin als Artefakt (lossless backup)
    let rawOriginRef: { fileId: string; fileName: string } | undefined

    try {
      const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      if (!library) {
        FileLogger.warn('MarkdownAdapter', 'Library not found, skipping raw origin storage', {
          libraryId,
        })
      } else {
        const shadowTwinService = new ShadowTwinService({
          library,
          userEmail,
          sourceId: storageItem.id,
          sourceName: storageItem.metadata?.name || 'document.md',
          parentId: storageItem.parentId || 'root',
          provider,
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _rawFileName = `${storageItem.metadata?.name || 'document.md'}.raw.md`
        const rawResult = await shadowTwinService.upsertMarkdown({
          kind: 'raw',
          targetLanguage: targetLanguage,
          markdown: originalMarkdown, // Original unverändert
        })

        rawOriginRef = {
          fileId: rawResult.id,
          fileName: rawResult.name,
        }

        FileLogger.info('MarkdownAdapter', 'Raw origin stored', {
          sourceId: storageItem.id,
          rawFileId: rawResult.id,
        })
      }
    } catch (error) {
      FileLogger.error('MarkdownAdapter', 'Failed to store raw origin', {
        sourceId: storageItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
      // Raw Origin ist optional, wir werfen nicht, sondern loggen nur
    }

    return {
      canonicalMarkdown,
      canonicalMeta,
      rawOriginRef,
    }
  }
}
