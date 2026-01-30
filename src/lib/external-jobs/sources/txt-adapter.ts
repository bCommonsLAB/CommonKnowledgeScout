/**
 * @fileoverview TXT Source Adapter - Normalisierung von Plain-Text-Dateien
 *
 * @description
 * Normalisiert Plain-Text-Dateien zu Canonical Markdown:
 * - Wrap Text in Markdown-Body
 * - Frontmatter generieren (Titel aus Dateiname, Datum, Typ)
 * - Raw Origin: Original-TXT-Datei als `raw` Artefakt speichern
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
import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'

/**
 * TXT Source Adapter.
 *
 * Normalisiert Plain-Text-Dateien zu Canonical Markdown mit Frontmatter.
 */
export class TxtAdapter implements SourceAdapter {
  async normalize(
    source: SourceInput,
    options?: SourceAdapterOptions
  ): Promise<CanonicalMarkdownResult> {
    if (source.type === 'url') {
      throw new Error('TxtAdapter does not support URL sources')
    }

    const storageItem = source as import('@/lib/storage/types').StorageItem
    const provider = options?.provider
    const userEmail = options?.userEmail || ''
    const libraryId = options?.libraryId || ''
    const targetLanguage = options?.targetLanguage || 'de'

    if (!provider) {
      throw new Error('StorageProvider is required for TxtAdapter')
    }

    if (!userEmail || !libraryId) {
      throw new Error('userEmail and libraryId are required for TxtAdapter')
    }

    // Lade Original-Text
    const bin = await provider.getBinary(storageItem.id)
    const originalText = await bin.blob.text()

    if (!originalText || originalText.trim().length === 0) {
      throw new Error('Text file is empty')
    }

    // Normalisiere Text (einheitliche Zeilenumbrüche, trim)
    const normalizedBody = originalText.trim().replace(/\r\n/g, '\n')

    // Generiere Canonical Meta (Frontmatter verpflichtend)
    const sourceFileName = storageItem.metadata?.name || storageItem.id
    const baseName = sourceFileName.replace(/\.(txt|log)$/i, '')

    const canonicalMeta: Record<string, unknown> = {
      source: sourceFileName,
      title: baseName || 'Untitled',
      date: new Date().toISOString(),
      type: 'txt',
      originRef: `raw:${storageItem.id}`,
    }

    // Erzeuge Canonical Markdown mit Frontmatter
    const canonicalMarkdown = createMarkdownWithFrontmatter(normalizedBody, canonicalMeta)

    // Speichere Raw Origin als Artefakt (lossless backup)
    let rawOriginRef: { fileId: string; fileName: string } | undefined

    try {
      const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      if (!library) {
        FileLogger.warn('TxtAdapter', 'Library not found, skipping raw origin storage', {
          libraryId,
        })
      } else {
        const shadowTwinService = new ShadowTwinService({
          library,
          userEmail,
          sourceId: storageItem.id,
          sourceName: sourceFileName,
          parentId: storageItem.parentId || 'root',
          provider,
        })

        const rawResult = await shadowTwinService.upsertMarkdown({
          kind: 'raw',
          targetLanguage: targetLanguage,
          markdown: originalText, // Original unverändert
        })

        rawOriginRef = {
          fileId: rawResult.id,
          fileName: rawResult.name,
        }

        FileLogger.info('TxtAdapter', 'Raw origin stored', {
          sourceId: storageItem.id,
          rawFileId: rawResult.id,
        })
      }
    } catch (error) {
      FileLogger.error('TxtAdapter', 'Failed to store raw origin', {
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
