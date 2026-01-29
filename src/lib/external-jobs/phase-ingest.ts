/**
 * @fileoverview Ingest-Phase-Modul für Phasen-Orchestrierung
 *
 * @description
 * Konsolidiert die gesamte Ingest-Phase-Logik aus Callback-Route und Start-Route.
 * Führt RAG-Ingestion durch mit Gate-Prüfung, Policy-Prüfung und Progress-Updates.
 *
 * @module external-jobs
 */

import type { RequestContext } from '@/types/external-jobs'
import type { StorageProvider } from '@/lib/storage/types'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { gateIngestRag } from '@/lib/processing/gates'
import { runIngestion } from '@/lib/external-jobs/ingest'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { handleJobError } from '@/lib/external-jobs/error-handler'
import { FileLogger } from '@/lib/debug/logger'
import { getServerProvider } from '@/lib/storage/server-provider'
import { loadShadowTwinMarkdown } from '@/lib/external-jobs/phase-shadow-twin-loader'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'

export interface IngestPhaseArgs {
  ctx: RequestContext
  provider: StorageProvider
  repo: ExternalJobsRepository
  markdown: string
  meta: Record<string, unknown>
  savedItemId: string
  policies: { ingest: 'force' | 'skip' | 'auto' | 'ignore' | 'do' }
  extractedText?: string
}

export interface IngestPhaseResult {
  completed: boolean
  skipped: boolean
  error?: string
}

/**
 * Führt die Ingest-Phase aus: RAG-Ingestion mit Gate- und Policy-Prüfung.
 *
 * @param args Ingest-Phase-Argumente
 * @returns Ingest-Phase-Ergebnis
 */
export async function runIngestPhase(args: IngestPhaseArgs): Promise<IngestPhaseResult> {
  const {
    ctx,
    repo,
    markdown,
    meta,
    savedItemId,
    policies,
    extractedText,
    provider,
  } = args

  const { jobId, job } = ctx
  
  // Lade Job-Dokument neu, um sicherzustellen, dass shadowTwinState aktuell ist
  // (kann sich während der Verarbeitung ändern)
  const freshJob = await repo.get(jobId)
  if (!freshJob) {
    FileLogger.error('phase-ingest', 'Job nicht gefunden', { jobId })
    return {
      completed: false,
      skipped: false,
      error: 'Job nicht gefunden',
    }
  }
  
  // Aktualisiere ctx.job mit freshJob, damit loadShadowTwinMarkdown shadowTwinState verwenden kann
  ctx.job = freshJob
  
  // Verwende Shadow-Twin-State aus aktuellem Job-Dokument (beim Job-Start berechnet)
  // Dies ist die zentrale Logik, die auch Template-Phase verwendet
  const shadowTwinFolderId = freshJob.shadowTwinState?.shadowTwinFolderId

  // SSE-Event: Ingest-Phase gestartet
  try {
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'running',
      phase: 'ingest',
      progress: 50,
      updatedAt: new Date().toISOString(),
      message: 'Story-Ingestion gestartet',
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
      sourceItemId: job.correlation?.source?.itemId,
    })
  } catch {}

  // Gate-Prüfung für RAG-Ingestion (nur bei 'auto' Policy relevant)
  let ingestGateExists = false
  if (policies.ingest === 'auto') {
    try {
      const lib = await (await import('@/lib/services/library-service')).LibraryService.getInstance()
      const library = await lib.getLibrary(job.userEmail, job.libraryId)
      const gate = await gateIngestRag({
        repo,
        jobId,
        userEmail: job.userEmail,
        library,
        source: job.correlation?.source,
        options: job.correlation?.options as { targetLanguage?: string } | undefined,
      })
      ingestGateExists = !!gate?.exists
      if (ingestGateExists) {
        bufferLog(jobId, { phase: 'ingest_gate_skip', message: gate.reason || 'artifact_exists' })
      }
    } catch (err) {
      FileLogger.error('phase-ingest', 'Fehler bei Gate-Prüfung', {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Policy-Prüfung
  const useIngestion = ((): boolean => {
    if (policies.ingest === 'force') return true
    if (policies.ingest === 'skip') return false
    if (policies.ingest === 'ignore') return false
    if (policies.ingest === 'auto') {
      return !ingestGateExists
    }
    return true // 'do' oder default
  })()

  bufferLog(jobId, { phase: 'ingest_rag', message: `Ingestion decision: ${useIngestion ? 'do' : 'skip'}` })
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'ingest',
      name: 'ingest_decision',
      attributes: {
        useIngestion,
        policiesIngest: policies.ingest,
        ingestGateExists,
      },
    })
  } catch {}

  if (!useIngestion) {
    await repo.updateStep(jobId, 'ingest_rag', {
      status: 'completed',
      endedAt: new Date(),
      details: {
        skipped: true,
        reason: ingestGateExists ? 'ingest_gate_exists' : 'policy_skip',
      },
    })
    return {
      completed: false,
      skipped: true,
    }
  }

  // Verwende übergebenen Provider oder erstelle Fallback-Provider für Bild-Verarbeitung (Cover + Markdown-Bilder)
  const ingestionProvider = provider || await getServerProvider(job.userEmail, job.libraryId)
  
  // Stabiler Schlüssel: Original-Quell-Item (PDF) bevorzugen, sonst Shadow‑Twin, sonst Fallback
  const fileId = (job.correlation.source?.itemId as string | undefined) || savedItemId || `${jobId}-md`
  
  // =========================================================================
  // Lade Markdown-Inhalt: Verwende zentrale loadShadowTwinMarkdown() Funktion
  //
  // WICHTIG - DETERMINISTISCHE QUELLENWAHL:
  // Ingest-Phase braucht das TRANSFORMIERTE Markdown (Phase 2 Ergebnis):
  // - Enthält Frontmatter mit Metadaten
  // - Ist für RAG-Ingestion optimiert
  // - Falls keine Transformation existiert, wird Transkript als Fallback verwendet
  // =========================================================================
  let markdownForIngestion = markdown || ''
  let metaForIngestion = meta
  
  // Versuche immer zuerst das transformierte Markdown aus dem Shadow-Twin zu laden
  // Nur wenn das fehlschlägt, verwende das übergebene markdown als Fallback
  try {
    // Verwende zentrale Shadow-Twin-Loader-Funktion mit explizitem Purpose
    const shadowTwinResult = await loadShadowTwinMarkdown(ctx, ingestionProvider, 'forIngestOrPassthrough')
    if (shadowTwinResult) {
      markdownForIngestion = shadowTwinResult.markdown
      // Meta aus Shadow-Twin überschreibt übergebenes Meta (falls vorhanden)
      if (Object.keys(shadowTwinResult.meta).length > 0) {
        metaForIngestion = shadowTwinResult.meta
      }
      // Aktualisiere fileId und fileName aus gefundener Datei
      const actualFileId = shadowTwinResult.fileId || fileId
      const sourceNameForFallback = job.correlation.source?.name || 'output'
      const sourceItemIdForFallback = job.correlation.source?.itemId || 'unknown'
      const langForFallback = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const actualFileName = shadowTwinResult.fileName || buildArtifactName({ sourceId: sourceItemIdForFallback, kind: 'transcript', targetLanguage: langForFallback }, sourceNameForFallback)
      
      FileLogger.info('phase-ingest', 'Markdown aus Shadow-Twin geladen', {
        jobId,
        fileId: actualFileId,
        fileName: actualFileName,
        markdownLength: markdownForIngestion.length,
        isTransformed: !!shadowTwinResult.meta.template, // Transformierte Dateien haben template im Frontmatter
      })
    } else {
      // Fallback: Verwende übergebenes markdown, wenn Shadow-Twin nicht gefunden wurde
      if (!markdownForIngestion && extractedText) {
        markdownForIngestion = extractedText
        FileLogger.warn('phase-ingest', 'Shadow-Twin-Markdown nicht gefunden, verwende extractedText als Fallback', {
          jobId,
          fileId,
          extractedTextLength: extractedText.length,
        })
      } else if (!markdownForIngestion) {
        FileLogger.warn('phase-ingest', 'Kein Markdown verfügbar für Ingestion', {
          jobId,
          fileId,
        })
      }
    }
  } catch (err) {
    FileLogger.error('phase-ingest', 'Fehler beim Laden des Shadow-Twin-Markdown', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    })
    // Fallback: Verwende übergebenes markdown oder extractedText
    if (!markdownForIngestion && extractedText) {
      markdownForIngestion = extractedText
    }
  }
  
  const sourceNameForFileName = job.correlation.source?.name || 'output'
  const sourceItemIdForFileName = job.correlation.source?.itemId || 'unknown'
  const langForFileName = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const fileName = buildArtifactName({ sourceId: sourceItemIdForFileName, kind: 'transcript', targetLanguage: langForFileName }, sourceNameForFileName)

  /**
   * PHASE-INPUT-VALIDIERUNG (Global Contract):
   *
   * Ingestion benötigt valides Markdown als Input.
   * Ein leerer Input führt zu leeren Chunks/Vektoren, die fälschlicherweise als Erfolg markiert werden.
   *
   * Mindestlänge: 10 Zeichen (nach trim) – das ist absichtlich niedrig, um nur echte Leer-Fälle zu fangen.
   */
  const MIN_INGEST_INPUT_CHARS = 10
  const markdownTrimmed = markdownForIngestion.trim()

  // Trace-Event für Input-Validierung (immer loggen, auch bei leerem Input)
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'ingest',
      name: 'phase_input_validation',
      attributes: {
        phase: 'ingest',
        inputLength: markdownTrimmed.length,
        minRequiredChars: MIN_INGEST_INPUT_CHARS,
        inputValid: markdownTrimmed.length >= MIN_INGEST_INPUT_CHARS,
        inputSource: markdownForIngestion === markdown ? 'passed_markdown' : markdownForIngestion === extractedText ? 'extracted_text' : 'shadow_twin',
      },
    })
  } catch {}

  // Harte Validierung: Wenn Input leer → Fehler
  if (markdownTrimmed.length < MIN_INGEST_INPUT_CHARS) {
    const errorMessage = `Ingest-Phase Input-Validierung fehlgeschlagen: Markdown ist leer oder zu kurz (${markdownTrimmed.length} Zeichen, Minimum: ${MIN_INGEST_INPUT_CHARS}). ` +
      `Mögliche Ursache: Vorherige Phase (Template/Extract) hat keinen Text produziert.`

    FileLogger.error('phase-ingest', errorMessage, {
      jobId,
      markdownLength: markdownTrimmed.length,
      fileId,
    })

    bufferLog(jobId, {
      phase: 'ingest_input_validation_failed',
      message: errorMessage,
      markdownLength: markdownTrimmed.length,
    })

    await repo.updateStep(jobId, 'ingest_rag', {
      status: 'failed',
      endedAt: new Date(),
      error: { message: errorMessage },
    })

    // Job als failed markieren
    await repo.setError(jobId, new Error(errorMessage))

    return {
      completed: false,
      skipped: false,
      error: errorMessage,
    }
  }

  let res
  try {
    res = await runIngestion({
      ctx,
      savedItemId: fileId,
      fileName,
      markdown: markdownForIngestion,
      meta: metaForIngestion as unknown as Record<string, unknown>,
      provider: ingestionProvider,
      shadowTwinFolderId,
    })
  } catch (err) {
    // Ingestion fehlgeschlagen → Step/Job als failed markieren
    const reason = (() => {
      if (err && typeof err === 'object') {
        const e = err as { message?: unknown }
        const msg = typeof e.message === 'string' ? e.message : undefined
        return msg || String(err)
      }
      return String(err)
    })()
    bufferLog(jobId, { phase: 'ingest_rag_failed', message: reason })
    FileLogger.error('phase-ingest', 'Ingestion failed (fatal)', err)
    await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'RAG Ingestion fehlgeschlagen', details: { reason } } })
    await handleJobError(
      err instanceof Error ? err : new Error(reason),
      {
        jobId,
        userEmail: job.userEmail,
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
        sourceItemId: job.correlation?.source?.itemId,
      },
      repo,
      'ingestion_failed',
      'ingest'
    )
    return {
      completed: false,
      skipped: false,
      error: reason,
    }
  }

  // Nach Chunking (50-70%)
  try {
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'running',
      phase: 'ingest',
      progress: 60,
      updatedAt: new Date().toISOString(),
      message: 'Chunks erstellt',
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
      sourceItemId: job.correlation?.source?.itemId,
    })
  } catch {}

  const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
  await repo.setIngestion(jobId, { upsertAt: new Date(), vectorsUpserted: total, index: res.index })

  // Zusammenfassung loggen
  bufferLog(jobId, { phase: 'ingest_rag', message: `RAG-Ingestion: ${res.chunksUpserted} Chunks, ${res.docUpserted ? 1 : 0} Doc` })
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'ingest',
      name: 'ingest_mongodb_upserted',
      attributes: {
        chunks: res.chunksUpserted,
        doc: res.docUpserted,
        total,
        vectorFileId: fileId,
      },
    })
  } catch {}
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'ingest',
      name: 'ingest_doc_id',
      attributes: {
        vectorFileId: fileId,
        fileName,
      },
    })
  } catch {}
  try {
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'running',
      phase: 'ingest',
      progress: 90,
      updatedAt: new Date().toISOString(),
      message: 'Vektoren gespeichert',
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
      sourceItemId: job.correlation?.source?.itemId,
    })
  } catch {}
  await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() })
  try {
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'running',
      phase: 'ingest',
      progress: 95,
      updatedAt: new Date().toISOString(),
      message: 'Story-Ingestion abgeschlossen',
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
      sourceItemId: job.correlation?.source?.itemId,
    })
  } catch {}

  return {
    completed: true,
    skipped: false,
  }
}


