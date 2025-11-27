/**
 * @fileoverview Shadow-Twin-Markdown-Loader für Phasen-Orchestrierung
 *
 * @description
 * Lädt Shadow-Twin-Markdown-Dateien und parst Frontmatter. Konsolidiert die wiederholte
 * Logik aus Start-Route und Callback-Route für einheitliche Verwendung in Template- und
 * Ingest-Phasen.
 *
 * @module external-jobs
 */

import type { RequestContext } from '@/types/external-jobs'
import type { StorageProvider } from '@/lib/storage/types'
import { findShadowTwinMarkdownFile } from '@/lib/external-jobs/shadow-twin-finder'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { FileLogger } from '@/lib/debug/logger'

export interface ShadowTwinMarkdownResult {
  markdown: string
  meta: Record<string, unknown>
  fileId: string
  fileName: string
}

/**
 * Lädt Shadow-Twin-Markdown-Datei und parst Frontmatter.
 *
 * @param ctx Request-Kontext
 * @param provider Storage-Provider
 * @param repo External-Jobs-Repository
 * @returns Shadow-Twin-Markdown-Daten oder null wenn nicht gefunden
 */
export async function loadShadowTwinMarkdown(
  ctx: RequestContext,
  provider: StorageProvider
): Promise<ShadowTwinMarkdownResult | null> {
  const { jobId, job } = ctx
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
  const twinName = `${baseName}.${lang}.md`
  const parentId = job.correlation?.source?.parentId || 'root'
  const originalName = job.correlation.source?.name || 'output'

  // Shadow-Twin-Markdown-Datei suchen
  const twin = await findShadowTwinMarkdownFile(parentId, baseName, lang, originalName, provider)

  if (!twin) {
    FileLogger.warn('phase-shadow-twin-loader', 'Shadow-Twin-Markdown nicht gefunden', {
      jobId,
      parentId,
      baseName,
      lang,
      twinName,
    })
    return null
  }

  try {
    // Markdown-Datei laden
    const bin = await provider.getBinary(twin.id)
    const markdownText = await bin.blob.text()

    // Frontmatter parsen
    const parsed = parseSecretaryMarkdownStrict(markdownText)
    const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
      ? (parsed.meta as Record<string, unknown>)
      : {}

    FileLogger.info('phase-shadow-twin-loader', 'Shadow-Twin-Markdown geladen', {
      jobId,
      fileId: twin.id,
      fileName: twinName,
      markdownLength: markdownText.length,
      hasMeta: Object.keys(meta).length > 0,
    })

    return {
      markdown: markdownText,
      meta,
      fileId: twin.id,
      fileName: twinName,
    }
  } catch (error) {
    FileLogger.error('phase-shadow-twin-loader', 'Fehler beim Laden der Shadow-Twin-Markdown', {
      jobId,
      fileId: twin.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

