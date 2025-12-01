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
  const searchStartTime = Date.now()
  FileLogger.info('phase-shadow-twin-loader', 'Starte Suche nach Shadow-Twin-Markdown', {
    jobId,
    parentId,
    baseName,
    lang,
    twinName,
    originalName,
  })
  
  const twin = await findShadowTwinMarkdownFile(parentId, baseName, lang, originalName, provider)
  const searchDuration = Date.now() - searchStartTime

  if (!twin) {
    FileLogger.warn('phase-shadow-twin-loader', 'Shadow-Twin-Markdown nicht gefunden', {
      jobId,
      parentId,
      baseName,
      lang,
      twinName,
      searchDurationMs: searchDuration,
    })
    return null
  }

  FileLogger.info('phase-shadow-twin-loader', 'Shadow-Twin-Markdown-Datei gefunden', {
    jobId,
    fileId: twin.id,
    fileName: twinName,
    searchDurationMs: searchDuration,
  })

  try {
    // Markdown-Datei laden mit Timeout-Überwachung
    const loadStartTime = Date.now()
    FileLogger.info('phase-shadow-twin-loader', 'Starte Laden der Markdown-Datei von Azure/OneDrive', {
      jobId,
      fileId: twin.id,
      fileName: twinName,
      providerType: provider.constructor.name,
    })
    
    const bin = await provider.getBinary(twin.id)
    const loadDuration = Date.now() - loadStartTime
    
    FileLogger.info('phase-shadow-twin-loader', 'Markdown-Datei erfolgreich geladen', {
      jobId,
      fileId: twin.id,
      fileName: twinName,
      loadDurationMs: loadDuration,
      blobSize: bin.blob.size,
      mimeType: bin.mimeType,
    })
    
    const textStartTime = Date.now()
    const markdownText = await bin.blob.text()
    const textDuration = Date.now() - textStartTime
    
    FileLogger.info('phase-shadow-twin-loader', 'Markdown-Text extrahiert', {
      jobId,
      fileId: twin.id,
      fileName: twinName,
      textDurationMs: textDuration,
      textLength: markdownText.length,
      totalDurationMs: loadDuration + textDuration,
    })

    // Frontmatter parsen
    const parsed = parseSecretaryMarkdownStrict(markdownText)
    const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
      ? (parsed.meta as Record<string, unknown>)
      : {}

    // Erweiterte Logging für Debugging
    const hasFrontmatterBlock = markdownText.trim().startsWith('---')
    const frontmatterPreview = markdownText.substring(0, Math.min(500, markdownText.length))
    
    FileLogger.info('phase-shadow-twin-loader', 'Shadow-Twin-Markdown geladen', {
      jobId,
      fileId: twin.id,
      fileName: twinName,
      markdownLength: markdownText.length,
      hasMeta: Object.keys(meta).length > 0,
      metaKeys: Object.keys(meta),
      hasFrontmatterBlock,
      frontmatterPreview: frontmatterPreview.substring(0, 200), // Erste 200 Zeichen für Debugging
      parsedMetaKeys: parsed?.meta && typeof parsed.meta === 'object' ? Object.keys(parsed.meta as Record<string, unknown>) : [],
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

