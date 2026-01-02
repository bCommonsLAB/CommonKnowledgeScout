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
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { getShadowTwinMode } from '@/lib/shadow-twin/mode-helper'
import { LibraryService } from '@/lib/services/library-service'

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
  const sourceItemId = job.correlation?.source?.itemId || ''

  // Priorität 1: Verwende shadowTwinState.transformed.id, falls verfügbar (direkter Zugriff)
  let twin: { id: string } | null = null
  
  if (job.shadowTwinState?.transformed?.id) {
    twin = { id: job.shadowTwinState.transformed.id }
  }

  // Priorität 2: Suche über Resolver (v2) oder findShadowTwinMarkdownFile (legacy)
  if (!twin) {
    // Ermittle Library-Modus
    let mode: 'legacy' | 'v2' = 'legacy'
    try {
      const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
      mode = getShadowTwinMode(library)
    } catch {
      // Fallback zu legacy bei Fehler
    }

    if (mode === 'v2' && sourceItemId) {
      // V2-Modus: Nutze neuen Resolver
      // Versuche zuerst Transformation (falls Template vorhanden), dann Transcript
      const templateName = job.parameters?.template as string | undefined
      
      let resolved = templateName
        ? await resolveArtifact(provider, {
            sourceItemId,
            sourceName: originalName,
            parentId,
            mode: 'v2',
            targetLanguage: lang,
            templateName,
            preferredKind: 'transformation',
          })
        : null

      if (!resolved) {
        // Fallback zu Transcript
        resolved = await resolveArtifact(provider, {
          sourceItemId,
          sourceName: originalName,
          parentId,
          mode: 'v2',
          targetLanguage: lang,
          preferredKind: 'transcript',
        })
      }

      if (resolved) {
        twin = { id: resolved.fileId }
      }
    }

    // Legacy-Fallback oder wenn v2 nichts gefunden hat
    if (!twin) {
      twin = await findShadowTwinMarkdownFile(parentId, baseName, lang, originalName, provider)
    }

    if (!twin) {
      FileLogger.warn('phase-shadow-twin-loader', 'Shadow-Twin-Markdown nicht gefunden', {
        jobId,
        parentId,
        baseName,
        lang,
        twinName,
        hasShadowTwinState: !!job.shadowTwinState,
        shadowTwinStateTransformedId: job.shadowTwinState?.transformed?.id,
        mode,
      })
      return null
    }
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

