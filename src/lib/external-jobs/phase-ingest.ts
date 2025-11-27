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
  
  // Verwende Shadow-Twin-State aus aktuellem Job-Dokument (beim Job-Start berechnet)
  // Dies ist die zentrale Logik, die auch Template-Phase verwendet
  const shadowTwinFolderId = freshJob.shadowTwinState?.shadowTwinFolderId

  // Gate-Prüfung für RAG-Ingestion
  let ingestGateExists = false
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

  if (!useIngestion || ingestGateExists) {
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
  
  // Lade Markdown-Inhalt: Verwende zentrale loadShadowTwinMarkdown() Funktion (wie Template-Phase)
  // Diese Funktion findet automatisch die richtige Shadow-Twin-Datei (Verzeichnis oder Parent)
  let markdownForIngestion = extractedText || markdown || ''
  let metaForIngestion = meta
  
  if (!markdownForIngestion) {
    try {
      // Verwende zentrale Shadow-Twin-Loader-Funktion
      const shadowTwinResult = await loadShadowTwinMarkdown(ctx, ingestionProvider)
      if (shadowTwinResult) {
        markdownForIngestion = shadowTwinResult.markdown
        // Meta aus Shadow-Twin überschreibt übergebenes Meta (falls vorhanden)
        if (Object.keys(shadowTwinResult.meta).length > 0) {
          metaForIngestion = shadowTwinResult.meta
        }
        // Aktualisiere fileId und fileName aus gefundener Datei
        const actualFileId = shadowTwinResult.fileId || fileId
        const actualFileName = shadowTwinResult.fileName || `${(job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')}.${(job.correlation.options?.targetLanguage as string | undefined) || 'de'}.md`
        
        FileLogger.info('phase-ingest', 'Markdown aus Shadow-Twin geladen', {
          jobId,
          fileId: actualFileId,
          fileName: actualFileName,
          markdownLength: markdownForIngestion.length,
        })
      } else {
        FileLogger.warn('phase-ingest', 'Shadow-Twin-Markdown nicht gefunden, verwende Fallback', {
          jobId,
          fileId,
        })
      }
    } catch (err) {
      FileLogger.error('phase-ingest', 'Fehler beim Laden des Shadow-Twin-Markdown', {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  
  const fileName = `${(job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')}.${(job.correlation.options?.targetLanguage as string | undefined) || 'de'}.md`

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
      progress: 60,
      updatedAt: new Date().toISOString(),
      message: 'ingest_chunking_done',
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
      name: 'ingest_pinecone_upserted',
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
      progress: 90,
      updatedAt: new Date().toISOString(),
      message: 'ingest_pinecone_upserted',
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
      progress: 95,
      updatedAt: new Date().toISOString(),
      message: 'ingest_rag_finished',
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


