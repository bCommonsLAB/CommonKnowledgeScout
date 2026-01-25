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
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { FileLogger } from '@/lib/debug/logger'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
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
  const parentId = job.correlation?.source?.parentId || 'root'
  const originalName = job.correlation.source?.name || 'output'
  const sourceItemId = job.correlation?.source?.itemId || 'unknown'

  // Priorität 1: Verwende shadowTwinState.transformed.id, falls verfügbar (direkter Zugriff)
  let twin: { id: string } | null = null
  let resolvedFileName: string | null = null
  
  if (job.shadowTwinState?.transformed?.id) {
    twin = { id: job.shadowTwinState.transformed.id }
  }

  // Priorität 2: Suche über Resolver (v2-only)
  if (!twin) {
    // Versuche zuerst Transformation (falls Template vorhanden), dann Transcript
    const templateName = job.parameters?.template as string | undefined

    let resolved = templateName
      ? await resolveArtifact(provider, {
          sourceItemId,
          sourceName: originalName,
          parentId,
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
        targetLanguage: lang,
        preferredKind: 'transcript',
      })
    }

    if (resolved) {
      twin = { id: resolved.fileId }
      resolvedFileName = resolved.fileName
    }

    if (!twin) {
      // Mongo-aware Fallback:
      // In Mongo-only Mode existiert kein Filesystem-Artefakt, daher kann `resolveArtifact()`
      // nichts finden. In diesem Fall versuchen wir es direkt über den ShadowTwinService.
      try {
        const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
        if (library) {
          const service = new ShadowTwinService({
            library,
            userEmail: job.userEmail,
            sourceId: sourceItemId,
            sourceName: originalName,
            parentId,
            provider, // optionaler Fallback-Store
          })

          // 1) Transformation (wenn Template gesetzt), sonst 2) Transcript
          const fromService =
            templateName
              ? await service.getMarkdown({ kind: 'transformation', targetLanguage: lang, templateName })
              : null

          const fallbackTranscript =
            fromService || await service.getMarkdown({ kind: 'transcript', targetLanguage: lang })

          if (fallbackTranscript) {
            const parsed = parseSecretaryMarkdownStrict(fallbackTranscript.markdown)
            const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
              ? (parsed.meta as Record<string, unknown>)
              : {}
            return {
              markdown: fallbackTranscript.markdown,
              meta,
              fileId: fallbackTranscript.id,
              fileName: fallbackTranscript.name,
            }
          }
        }
      } catch {
        // best effort – wenn Mongo nicht verfügbar ist, bleibt es bei "not found"
      }

      FileLogger.warn('phase-shadow-twin-loader', 'Shadow-Twin-Markdown nicht gefunden', {
        jobId,
        parentId,
        sourceName: originalName,
        lang,
        hasShadowTwinState: !!job.shadowTwinState,
        shadowTwinStateTransformedId: job.shadowTwinState?.transformed?.id,
      })
      return null
    }
  }

  try {
    // MongoDB-Shadow-Twin-IDs können NICHT über den Provider geladen werden.
    // In diesem Fall laden wir das Markdown über den ShadowTwinService (Mongo-Store).
    if (twin && isMongoShadowTwinId(twin.id)) {
      const parts = parseMongoShadowTwinId(twin.id)
      if (!parts) return null

      const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
      if (!library) {
        FileLogger.warn('phase-shadow-twin-loader', 'Library nicht gefunden für Mongo-Shadow-Twin', { jobId, libraryId: job.libraryId })
        return null
      }

      const service = new ShadowTwinService({
        library,
        userEmail: job.userEmail,
        sourceId: parts.sourceId,
        sourceName: originalName,
        parentId,
        provider, // Fallback (optional)
      })

      const result = await service.getMarkdown({
        kind: parts.kind,
        targetLanguage: parts.targetLanguage || lang,
        templateName: parts.templateName,
      })
      if (!result) return null

      const parsed = parseSecretaryMarkdownStrict(result.markdown)
      const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
        ? (parsed.meta as Record<string, unknown>)
        : {}

      return {
        markdown: result.markdown,
        meta,
        fileId: result.id,
        fileName: result.name,
      }
    }

    // Markdown-Datei laden
    const bin = await provider.getBinary(twin.id)
    const markdownText = await bin.blob.text()

    // Frontmatter parsen
    const parsed = parseSecretaryMarkdownStrict(markdownText)
    const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
      ? (parsed.meta as Record<string, unknown>)
      : {}

    // Fallback-Dateiname mit zentraler Logik generieren, falls nicht von Resolver geliefert
    const fallbackFileName = resolvedFileName || buildArtifactName({ sourceId: sourceItemId, kind: 'transcript', targetLanguage: lang }, originalName)
    
    return {
      markdown: markdownText,
      meta,
      fileId: twin.id,
      fileName: fallbackFileName,
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

