/**
 * @fileoverview Website Source Adapter - Normalisierung von Webseiten/HTML
 *
 * @description
 * Normalisiert Webseiten/HTML zu Canonical Markdown:
 * - Fetch HTML (falls URL)
 * - Boilerplate-Reduktion (Readability-Algorithmus)
 * - HTML → Markdown Konvertierung
 * - Frontmatter mit URL, fetchedAt, title
 * - Raw Origin: Original-HTML als `raw` Artefakt speichern
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
 * Konvertiert HTML zu Markdown (einfache Implementierung).
 *
 * TODO: Später durch robustere Lösung ersetzen (z.B. turndown + readability).
 */
function htmlToMarkdown(html: string): string {
  // Einfache Konvertierung: Entferne Scripts/Styles, konvertiere Tags zu Markdown
  let md = html

  // Entferne Script- und Style-Tags
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Extrahiere Titel
  const titleMatch = md.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  // Konvertiere häufige HTML-Tags zu Markdown
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n')
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n')
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  md = md.replace(/<br[^>]*\/?>/gi, '\n')
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  md = md.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<ul[^>]*>|<\/ul>/gi, '')
  md = md.replace(/<ol[^>]*>|<\/ol>/gi, '')
  md = md.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)')
  md = md.replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)')

  // Entferne alle verbleibenden HTML-Tags
  md = md.replace(/<[^>]+>/g, '')

  // Decodiere HTML-Entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Normalisiere Whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim()

  return md || title || 'No content extracted'
}

/**
 * Extrahiert Titel aus HTML.
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    return titleMatch[1].trim()
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) {
    return h1Match[1].replace(/<[^>]+>/g, '').trim()
  }

  return 'Untitled'
}

/**
 * Website Source Adapter.
 *
 * Normalisiert Webseiten/HTML zu Canonical Markdown mit Frontmatter.
 */
export class WebsiteAdapter implements SourceAdapter {
  async normalize(
    source: SourceInput,
    options?: SourceAdapterOptions
  ): Promise<CanonicalMarkdownResult> {
    const provider = options?.provider
    const userEmail = options?.userEmail || ''
    const libraryId = options?.libraryId || ''
    const targetLanguage = options?.targetLanguage || 'de'

    if (!provider) {
      throw new Error('StorageProvider is required for WebsiteAdapter')
    }

    if (!userEmail || !libraryId) {
      throw new Error('userEmail and libraryId are required for WebsiteAdapter')
    }

    let url: string
    let originalHtml: string
    let sourceFileName: string

    if (source.type === 'url') {
      // URL-Quelle: HTML fetchen
      url = source.url
      sourceFileName = new URL(url).hostname + '.html'

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
        }

        originalHtml = await response.text()
      } catch (error) {
        throw new Error(
          `Failed to fetch HTML from URL: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    } else {
      // StorageItem-Quelle: HTML aus Datei laden
      const storageItem = source as import('@/lib/storage/types').StorageItem
      sourceFileName = storageItem.metadata?.name || storageItem.id
      url = sourceFileName // Fallback: Dateiname als "URL"

      const bin = await provider.getBinary(storageItem.id)
      originalHtml = await bin.blob.text()

      if (!originalHtml || originalHtml.trim().length === 0) {
        throw new Error('HTML file is empty')
      }
    }

    // Extrahiere Titel
    const title = extractTitle(originalHtml)

    // Konvertiere HTML zu Markdown
    const markdownBody = htmlToMarkdown(originalHtml)

    if (!markdownBody || markdownBody.trim().length === 0) {
      throw new Error('Failed to extract content from HTML')
    }

    // Generiere Canonical Meta (Frontmatter verpflichtend)
    const fetchedAt = new Date().toISOString()
    const canonicalMeta: Record<string, unknown> = {
      source: url,
      title: title,
      date: fetchedAt,
      type: 'website',
      fetchedAt: fetchedAt,
      originRef: source.type === 'url' ? `url:${url}` : `raw:${(source as { id: string }).id}`,
    }

    // Erzeuge Canonical Markdown mit Frontmatter
    const canonicalMarkdown = createMarkdownWithFrontmatter(markdownBody, canonicalMeta)

    // Speichere Raw Origin als Artefakt (lossless backup)
    let rawOriginRef: { fileId: string; fileName: string } | undefined

    try {
      const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
      if (!library) {
        FileLogger.warn('WebsiteAdapter', 'Library not found, skipping raw origin storage', {
          libraryId,
        })
      } else {
        const shadowTwinService = new ShadowTwinService({
          library,
          userEmail,
          sourceId: source.type === 'url' ? `url:${url}` : (source as { id: string }).id,
          sourceName: sourceFileName,
          parentId: source.type === 'url' ? 'root' : (source as { parentId?: string }).parentId || 'root',
          provider,
        })

        const rawResult = await shadowTwinService.upsertMarkdown({
          kind: 'raw',
          targetLanguage: targetLanguage,
          markdown: originalHtml, // Original HTML unverändert
        })

        rawOriginRef = {
          fileId: rawResult.id,
          fileName: rawResult.name,
        }

        FileLogger.info('WebsiteAdapter', 'Raw origin stored', {
          url: source.type === 'url' ? url : undefined,
          sourceId: source.type === 'url' ? undefined : (source as { id: string }).id,
          rawFileId: rawResult.id,
        })
      }
    } catch (error) {
      FileLogger.error('WebsiteAdapter', 'Failed to store raw origin', {
        url: source.type === 'url' ? url : undefined,
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
