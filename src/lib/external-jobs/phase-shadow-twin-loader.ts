/**
 * @fileoverview Shadow-Twin-Markdown-Loader für Phasen-Orchestrierung
 *
 * @description
 * Lädt Shadow-Twin-Markdown-Dateien und parst Frontmatter. Konsolidiert die wiederholte
 * Logik aus Start-Route und Callback-Route für einheitliche Verwendung in Template- und
 * Ingest-Phasen.
 *
 * WICHTIG - DETERMINISTISCHE QUELLENWAHL:
 * ========================================
 * Die Funktion `loadShadowTwinMarkdown()` erfordert einen expliziten `purpose` Parameter,
 * der bestimmt, welche Quelle geladen wird:
 *
 * - `'forTemplateTransformation'`: Lädt das TRANSKRIPT (Phase 1 Ergebnis)
 *   → Verwendung: Wenn die Template-Phase AUSGEFÜHRT wird
 *   → Logik: Der Transformer darf NIEMALS seine eigenen Daten als Quelle verwenden
 *
 * - `'forIngestOrPassthrough'`: Lädt die TRANSFORMATION (Phase 2 Ergebnis)
 *   → Verwendung: Für Ingest-Phase oder wenn Template übersprungen wird
 *   → Logik: Ingest braucht das transformierte Markdown mit Metadaten
 *
 * Diese explizite Unterscheidung verhindert den Bug, dass bei Re-Transformation
 * die vorherige (möglicherweise fehlerhafte) Transformation als Quelle verwendet wird.
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

/**
 * DETERMINISTISCHE QUELLENWAHL - Purpose Enum
 *
 * Der `purpose` Parameter ist REQUIRED und bestimmt die Quellenstrategie:
 *
 * @example
 * // Template-Phase wird AUSGEFÜHRT → braucht Transkript als Quelle
 * loadShadowTwinMarkdown(ctx, provider, 'forTemplateTransformation')
 *
 * @example
 * // Ingest-Phase oder Template übersprungen → braucht transformierte Datei
 * loadShadowTwinMarkdown(ctx, provider, 'forIngestOrPassthrough')
 */
export type ShadowTwinLoadPurpose =
  /**
   * Lädt das TRANSKRIPT (Phase 1 Ergebnis).
   *
   * Verwendung: Wenn die Template-Phase AUSGEFÜHRT wird.
   *
   * WICHTIG: Der Transformer darf NIEMALS seine eigenen Daten als Quelle verwenden!
   * Andernfalls würde eine fehlerhafte Transformation (z.B. nur Summary) bei
   * Re-Transformation wieder als Input dienen → Garbage In, Garbage Out.
   */
  | 'forTemplateTransformation'

  /**
   * Lädt die TRANSFORMATION (Phase 2 Ergebnis), Fallback: Transkript.
   *
   * Verwendung:
   * - Ingest-Phase: Braucht das transformierte Markdown mit Metadaten
   * - Template übersprungen: Bestehendes Ergebnis wird an nächste Phase weitergegeben
   */
  | 'forIngestOrPassthrough'

export interface ShadowTwinMarkdownResult {
  markdown: string
  meta: Record<string, unknown>
  fileId: string
  fileName: string
  /**
   * Welche Art von Artefakt wurde geladen?
   * Hilft beim Debugging und bei der Verifizierung der Quellenwahl.
   */
  loadedArtifactKind: 'transcript' | 'transformation'
}

/**
 * Lädt Shadow-Twin-Markdown-Datei und parst Frontmatter.
 *
 * WICHTIG - DETERMINISTISCHE QUELLENWAHL:
 * Der `purpose` Parameter ist REQUIRED und bestimmt, welche Quelle geladen wird.
 * Siehe `ShadowTwinLoadPurpose` für Details.
 *
 * @param ctx Request-Kontext
 * @param provider Storage-Provider
 * @param purpose REQUIRED - Bestimmt ob Transkript oder Transformation geladen wird
 * @returns Shadow-Twin-Markdown-Daten oder null wenn nicht gefunden
 *
 * @example
 * // Template-Phase wird AUSGEFÜHRT → braucht Transkript
 * const source = await loadShadowTwinMarkdown(ctx, provider, 'forTemplateTransformation')
 *
 * @example
 * // Ingest-Phase → braucht transformierte Datei
 * const source = await loadShadowTwinMarkdown(ctx, provider, 'forIngestOrPassthrough')
 */
export async function loadShadowTwinMarkdown(
  ctx: RequestContext,
  provider: StorageProvider,
  purpose: ShadowTwinLoadPurpose
): Promise<ShadowTwinMarkdownResult | null> {
  const { jobId, job } = ctx
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const parentId = job.correlation?.source?.parentId || 'root'
  const originalName = job.correlation.source?.name || 'output'
  const sourceItemId = job.correlation?.source?.itemId || 'unknown'
  const templateName = job.parameters?.template as string | undefined

  // ============================================================================
  // DETERMINISTISCHE QUELLENWAHL basierend auf `purpose`
  // ============================================================================
  //
  // forTemplateTransformation:
  //   → Lädt TRANSKRIPT (Phase 1 Ergebnis)
  //   → Der Transformer darf NIEMALS seine eigenen Daten als Quelle verwenden!
  //
  // forIngestOrPassthrough:
  //   → Lädt TRANSFORMATION (Phase 2 Ergebnis), Fallback: Transkript
  //   → Ingest braucht das transformierte Markdown mit Metadaten
  //
  // ============================================================================

  FileLogger.info('phase-shadow-twin-loader', 'Shadow-Twin-Markdown laden', {
    jobId,
    purpose,
    parentId,
    sourceName: originalName,
    lang,
    templateName: templateName || null,
    hasShadowTwinState: !!job.shadowTwinState,
    hasTransformedId: !!job.shadowTwinState?.transformed?.id,
    hasTranscriptFiles: Array.isArray(job.shadowTwinState?.transcriptFiles) && job.shadowTwinState!.transcriptFiles!.length > 0,
  })

  // ============================================================================
  // QUELLEN-STRATEGIE basierend auf purpose
  // ============================================================================

  if (purpose === 'forTemplateTransformation') {
    // =========================================================================
    // TRANSKRIPT LADEN (für Template-Transformation)
    // =========================================================================
    //
    // WICHTIG: Der Transformer darf NIEMALS seine eigenen Daten als Quelle verwenden!
    // Wir laden EXPLIZIT das Transkript (Phase 1 Ergebnis).
    //
    // Prioritäten:
    // 1. shadowTwinState.transcriptFiles[0] (direkt aus Job-State)
    // 2. ShadowTwinService.getMarkdown({ kind: 'transcript' })
    // 3. resolveArtifact mit preferredKind: 'transcript'
    //
    // =========================================================================

    // Priorität 1: Direkt aus shadowTwinState.transcriptFiles
    const transcriptFiles = job.shadowTwinState?.transcriptFiles
    if (Array.isArray(transcriptFiles) && transcriptFiles.length > 0) {
      const firstTranscript = transcriptFiles[0]
      const transcriptId = typeof firstTranscript?.id === 'string' ? firstTranscript.id : null
      const transcriptName = typeof firstTranscript?.metadata?.name === 'string' ? firstTranscript.metadata.name : null

      if (transcriptId) {
        FileLogger.info('phase-shadow-twin-loader', 'Transkript aus shadowTwinState.transcriptFiles laden', {
          jobId,
          purpose,
          transcriptId,
          transcriptName,
        })

        const result = await loadMarkdownById(ctx, provider, transcriptId, transcriptName, originalName, lang, sourceItemId, parentId)
        if (result) {
          return { ...result, loadedArtifactKind: 'transcript' }
        }
        // Falls Laden fehlschlägt, versuche Fallback
      }
    }

    // Priorität 2: ShadowTwinService (Mongo-Store)
    try {
      const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
      if (library) {
        const service = new ShadowTwinService({
          library,
          userEmail: job.userEmail,
          sourceId: sourceItemId,
          sourceName: originalName,
          parentId,
          provider,
        })

        // EXPLIZIT Transkript anfordern (NICHT Transformation!)
        const transcriptResult = await service.getMarkdown({
          kind: 'transcript',
          targetLanguage: lang,
        })

        if (transcriptResult) {
          FileLogger.info('phase-shadow-twin-loader', 'Transkript über ShadowTwinService geladen', {
            jobId,
            purpose,
            fileId: transcriptResult.id,
            fileName: transcriptResult.name,
            markdownLength: transcriptResult.markdown.length,
          })

          const parsed = parseSecretaryMarkdownStrict(transcriptResult.markdown)
          const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
            ? (parsed.meta as Record<string, unknown>)
            : {}

          return {
            markdown: transcriptResult.markdown,
            meta,
            fileId: transcriptResult.id,
            fileName: transcriptResult.name,
            loadedArtifactKind: 'transcript',
          }
        }
      }
    } catch (error) {
      FileLogger.warn('phase-shadow-twin-loader', 'Fehler beim Laden des Transkripts über ShadowTwinService', {
        jobId,
        purpose,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Priorität 3: resolveArtifact mit preferredKind: 'transcript'
    const resolved = await resolveArtifact(provider, {
      sourceItemId,
      sourceName: originalName,
      parentId,
      targetLanguage: lang,
      preferredKind: 'transcript',
    })

    if (resolved) {
      FileLogger.info('phase-shadow-twin-loader', 'Transkript über resolveArtifact geladen', {
        jobId,
        purpose,
        fileId: resolved.fileId,
        fileName: resolved.fileName,
      })

      const result = await loadMarkdownById(ctx, provider, resolved.fileId, resolved.fileName, originalName, lang, sourceItemId, parentId)
      if (result) {
        return { ...result, loadedArtifactKind: 'transcript' }
      }
    }

    // Priorität 4: Fallback für Markdown-Quellen
    // Bei Markdown-Dateien ist die Quelldatei selbst das "Transkript" - 
    // kein separates Artefakt erforderlich
    const sourceMediaType = job.correlation?.source?.mediaType
    const isMarkdownSource = sourceMediaType === 'markdown' || 
                             originalName.toLowerCase().endsWith('.md') ||
                             job.job_type === 'text'
    
    if (isMarkdownSource && sourceItemId) {
      FileLogger.info('phase-shadow-twin-loader', 'Markdown-Quelle als Transkript-Fallback verwenden', {
        jobId,
        purpose,
        sourceItemId,
        sourceName: originalName,
        sourceMediaType,
      })
      
      // Lade die Quelldatei direkt als "Transkript"
      const result = await loadMarkdownById(ctx, provider, sourceItemId, originalName, originalName, lang, sourceItemId, parentId)
      if (result) {
        return { ...result, loadedArtifactKind: 'transcript' }
      }
    }

    // Kein Transkript gefunden
    FileLogger.warn('phase-shadow-twin-loader', 'Transkript nicht gefunden (forTemplateTransformation)', {
      jobId,
      purpose,
      parentId,
      sourceName: originalName,
      lang,
      hasShadowTwinState: !!job.shadowTwinState,
      transcriptFilesCount: transcriptFiles?.length || 0,
      isMarkdownSource,
      sourceMediaType,
    })
    return null

  } else {
    // =========================================================================
    // TRANSFORMATION LADEN (für Ingest oder Passthrough)
    // =========================================================================
    //
    // Prioritäten:
    // 1. shadowTwinState.transformed.id (direkt aus Job-State)
    // 2. ShadowTwinService.getMarkdown({ kind: 'transformation' })
    // 3. resolveArtifact mit preferredKind: 'transformation'
    // 4. Fallback: Transkript (falls keine Transformation existiert)
    //
    // =========================================================================

    // Priorität 1: shadowTwinState.transformed.id
    if (job.shadowTwinState?.transformed?.id) {
      const transformedId = job.shadowTwinState.transformed.id
      const transformedName = typeof job.shadowTwinState.transformed.metadata?.name === 'string'
        ? job.shadowTwinState.transformed.metadata.name
        : null

      FileLogger.info('phase-shadow-twin-loader', 'Transformation aus shadowTwinState.transformed laden', {
        jobId,
        purpose,
        transformedId,
        transformedName,
      })

      const result = await loadMarkdownById(ctx, provider, transformedId, transformedName, originalName, lang, sourceItemId, parentId)
      if (result) {
        return { ...result, loadedArtifactKind: 'transformation' }
      }
      // Falls Laden fehlschlägt, versuche Fallback
    }

    // Priorität 2: ShadowTwinService (Mongo-Store)
    try {
      const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
      if (library) {
        const service = new ShadowTwinService({
          library,
          userEmail: job.userEmail,
          sourceId: sourceItemId,
          sourceName: originalName,
          parentId,
          provider,
        })

        // Zuerst Transformation versuchen (falls Template vorhanden)
        const transformationResult = templateName
          ? await service.getMarkdown({
              kind: 'transformation',
              targetLanguage: lang,
              templateName,
            })
          : null

        if (transformationResult) {
          FileLogger.info('phase-shadow-twin-loader', 'Transformation über ShadowTwinService geladen', {
            jobId,
            purpose,
            fileId: transformationResult.id,
            fileName: transformationResult.name,
            markdownLength: transformationResult.markdown.length,
          })

          const parsed = parseSecretaryMarkdownStrict(transformationResult.markdown)
          const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
            ? (parsed.meta as Record<string, unknown>)
            : {}

          return {
            markdown: transformationResult.markdown,
            meta,
            fileId: transformationResult.id,
            fileName: transformationResult.name,
            loadedArtifactKind: 'transformation',
          }
        }

        // Fallback zu Transkript
        const transcriptResult = await service.getMarkdown({
          kind: 'transcript',
          targetLanguage: lang,
        })

        if (transcriptResult) {
          FileLogger.info('phase-shadow-twin-loader', 'Fallback: Transkript über ShadowTwinService geladen (keine Transformation)', {
            jobId,
            purpose,
            fileId: transcriptResult.id,
            fileName: transcriptResult.name,
          })

          const parsed = parseSecretaryMarkdownStrict(transcriptResult.markdown)
          const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
            ? (parsed.meta as Record<string, unknown>)
            : {}

          return {
            markdown: transcriptResult.markdown,
            meta,
            fileId: transcriptResult.id,
            fileName: transcriptResult.name,
            loadedArtifactKind: 'transcript',
          }
        }
      }
    } catch (error) {
      FileLogger.warn('phase-shadow-twin-loader', 'Fehler beim Laden über ShadowTwinService', {
        jobId,
        purpose,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Priorität 3: resolveArtifact
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
      const isTransformation = resolved.fileName.includes(templateName || '')
      FileLogger.info('phase-shadow-twin-loader', `${isTransformation ? 'Transformation' : 'Transkript'} über resolveArtifact geladen`, {
        jobId,
        purpose,
        fileId: resolved.fileId,
        fileName: resolved.fileName,
      })

      const result = await loadMarkdownById(ctx, provider, resolved.fileId, resolved.fileName, originalName, lang, sourceItemId, parentId)
      if (result) {
        return { ...result, loadedArtifactKind: isTransformation ? 'transformation' : 'transcript' }
      }
    }

    // Nichts gefunden
    FileLogger.warn('phase-shadow-twin-loader', 'Shadow-Twin-Markdown nicht gefunden (forIngestOrPassthrough)', {
      jobId,
      purpose,
      parentId,
      sourceName: originalName,
      lang,
      hasShadowTwinState: !!job.shadowTwinState,
      shadowTwinStateTransformedId: job.shadowTwinState?.transformed?.id,
    })
    return null
  }
}

/**
 * Hilfsfunktion: Lädt Markdown-Datei anhand der ID.
 * Unterstützt sowohl Mongo-Shadow-Twin-IDs als auch Filesystem-IDs.
 */
async function loadMarkdownById(
  ctx: RequestContext,
  provider: StorageProvider,
  fileId: string,
  fileName: string | null,
  originalName: string,
  lang: string,
  sourceItemId: string,
  parentId: string
): Promise<Omit<ShadowTwinMarkdownResult, 'loadedArtifactKind'> | null> {
  const { jobId, job } = ctx

  try {
    // MongoDB-Shadow-Twin-IDs können NICHT über den Provider geladen werden.
    // In diesem Fall laden wir das Markdown über den ShadowTwinService (Mongo-Store).
    if (isMongoShadowTwinId(fileId)) {
      const parts = parseMongoShadowTwinId(fileId)
      if (!parts) {
        FileLogger.warn('phase-shadow-twin-loader', 'Ungültige Mongo-Shadow-Twin-ID', { jobId, fileId })
        return null
      }

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
        provider,
      })

      const result = await service.getMarkdown({
        kind: parts.kind,
        targetLanguage: parts.targetLanguage || lang,
        templateName: parts.templateName,
      })

      if (!result) {
        FileLogger.warn('phase-shadow-twin-loader', 'Markdown nicht gefunden im Mongo-Store', { jobId, fileId, parts })
        return null
      }

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

    // Filesystem-Provider: Laden über getBinary
    const bin = await provider.getBinary(fileId)
    const markdownText = await bin.blob.text()

    const parsed = parseSecretaryMarkdownStrict(markdownText)
    const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
      ? (parsed.meta as Record<string, unknown>)
      : {}

    // Fallback-Dateiname generieren, falls nicht übergeben
    const fallbackFileName = fileName || buildArtifactName({ sourceId: sourceItemId, kind: 'transcript', targetLanguage: lang }, originalName)

    return {
      markdown: markdownText,
      meta,
      fileId,
      fileName: fallbackFileName,
    }
  } catch (error) {
    FileLogger.error('phase-shadow-twin-loader', 'Fehler beim Laden der Markdown-Datei', {
      jobId,
      fileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

