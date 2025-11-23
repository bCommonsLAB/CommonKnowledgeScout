/**
 * @fileoverview External Jobs Start API Route - Job Execution Trigger
 * 
 * @description
 * Endpoint for starting external job execution. Handles job preprocessing, Secretary Service
 * request initiation, watchdog setup, and initial job state management. Called by the worker
 * to trigger job processing. Supports both authenticated users and internal worker requests.
 * 
 * @module external-jobs
 * 
 * @exports
 * - POST: Starts job execution and triggers Secretary Service processing
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/external/jobs/[jobId]/start
 * - src/lib/external-jobs-worker.ts: Worker calls this endpoint to start jobs
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository
 * - @/lib/external-jobs/preprocess: Job preprocessing
 * - @/lib/external-jobs/auth: Internal authorization check
 * - @/lib/external-jobs-watchdog: Watchdog for timeout monitoring
 * - @/lib/secretary/client: Secretary Service client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getPublicAppUrl, getSecretaryConfig } from '@/lib/env'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { startWatchdog, bumpWatchdog } from '@/lib/external-jobs-watchdog'
import { preprocess } from '@/lib/external-jobs/preprocess'
import type { RequestContext } from '@/types/external-jobs'
import type { PreprocessResult } from '@/lib/external-jobs/preprocess'
import { runIngestion } from '@/lib/external-jobs/ingest'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { isInternalAuthorized } from '@/lib/external-jobs/auth'
import { findShadowTwinFolder, findShadowTwinMarkdown } from '@/lib/storage/shadow-twin'
import { FileLogger } from '@/lib/debug/logger'
import { analyzeShadowTwin } from '@/lib/shadow-twin/analyze-shadow-twin'
import { toMongoShadowTwinState } from '@/lib/shadow-twin/shared'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    // Interner Worker darf ohne Clerk durch, wenn Token korrekt
    const internal = isInternalAuthorized(request)
    let userEmail = ''
    if (!internal.isInternal) {
      const { userId } = getAuth(request)
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
    }
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    let job: Awaited<ReturnType<typeof repo.get>>
    try {
      job = await repo.get(jobId)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Laden des Jobs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      return NextResponse.json({ error: 'Fehler beim Laden des Jobs' }, { status: 500 })
    }
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
    if (!internal.isInternal) {
      if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // WICHTIG: Watchdog SOFORT starten, damit Job nicht hängen bleibt, wenn Start-Endpoint fehlschlägt
    // Timeout: 10 Minuten (600_000 ms) - sollte ausreichen für Datei-Laden, Preprocessing, Request, etc.
    // Der Watchdog wird später via bumpWatchdog aktualisiert, wenn Callbacks vom Secretary Service kommen
    try {
      startWatchdog({ 
        jobId, 
        userEmail: job.userEmail, 
        jobType: job.job_type, 
        fileName: job.correlation?.source?.name 
      }, 600_000)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Starten des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Watchdog-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    // Prüfe, ob Job bereits gestartet wurde
    // WICHTIG: Erlaube Neustart von fehlgeschlagenen Jobs
    // Ein Job kann erneut gestartet werden, wenn:
    // 1. Er noch nie gestartet wurde (kein request_ack Event), ODER
    // 2. Er fehlgeschlagen ist (status === 'failed'), ODER
    // 3. Das letzte request_ack Event älter als 10 Minuten ist (Job könnte hängen geblieben sein)
    const alreadyRequested = (() => {
      try {
        const evts = ((job as unknown as { trace?: { events?: Array<{ name?: unknown; ts?: unknown }> } }).trace?.events) || []
        if (!Array.isArray(evts)) return false
        
        const now = Date.now()
        const tenMinutesAgo = now - 600_000 // 10 Minuten in Millisekunden
        
        // Finde das neueste relevante Event
        const relevantEvents = evts.filter(e => {
          if (typeof e?.name !== 'string') return false
          return e.name === 'request_ack' || e.name === 'secretary_request_ack' || e.name === 'secretary_request_accepted'
        })
        
        if (relevantEvents.length === 0) return false
        
        // Prüfe, ob das neueste Event jünger als 10 Minuten ist
        const newestEvent = relevantEvents.reduce((latest, current) => {
          const currentTs = current.ts instanceof Date ? current.ts.getTime() : (typeof current.ts === 'string' ? new Date(current.ts).getTime() : 0)
          const latestTs = latest.ts instanceof Date ? latest.ts.getTime() : (typeof latest.ts === 'string' ? new Date(latest.ts).getTime() : 0)
          return currentTs > latestTs ? current : latest
        })
        
        const eventTs = newestEvent.ts instanceof Date ? newestEvent.ts.getTime() : (typeof newestEvent.ts === 'string' ? new Date(newestEvent.ts).getTime() : 0)
        
        // Wenn Event älter als 10 Minuten ist, erlaube Neustart
        if (eventTs < tenMinutesAgo) {
          FileLogger.info('start-route', 'request_ack Event ist älter als 10 Minuten - erlaube Neustart', {
            jobId,
            eventAgeMs: now - eventTs,
            eventAgeMinutes: Math.floor((now - eventTs) / 60000)
          })
          return false
        }
        
        return true
      } catch { return false }
    })()
    // Erlaube Neustart, wenn Job fehlgeschlagen ist
    const isFailed = job.status === 'failed'
    if (alreadyRequested && !isFailed) {
      try { await repo.traceAddEvent(jobId, { spanId: 'job', name: 'start_already_started' }) } catch {}
      return NextResponse.json({ ok: true, status: 'already_started' }, { status: 202 })
    }
    // Wenn Job fehlgeschlagen ist, lösche processId, damit neue Callbacks akzeptiert werden
    if (isFailed && job.processId) {
      try {
        const col = await (await import('@/lib/mongodb-service')).getCollection<import('@/types/external-job').ExternalJob>('external_jobs')
        await col.updateOne({ jobId }, { $unset: { processId: '' }, $set: { updatedAt: new Date() } })
        FileLogger.info('start-route', 'Fehlgeschlagener Job wird neu gestartet', {
          jobId,
          oldProcessId: job.processId
        })
      } catch {}
    }

    // Secretary-Aufruf vorbereiten (aus alter Retry-Startlogik entnommen, minimal)
    let provider: Awaited<ReturnType<typeof getServerProvider>>
    try {
      provider = await getServerProvider(job.userEmail, job.libraryId)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Laden des Storage-Providers', {
        jobId,
        userEmail: job.userEmail,
        libraryId: job.libraryId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'provider_error', message: 'Fehler beim Laden des Storage-Providers' } })
      return NextResponse.json({ error: 'Fehler beim Laden des Storage-Providers' }, { status: 500 })
    }
    
    const src = job.correlation?.source
    if (!src?.itemId || !src?.parentId) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'source_incomplete', message: 'Quelle unvollständig' } })
      return NextResponse.json({ error: 'Quelle unvollständig' }, { status: 400 })
    }
    
    FileLogger.info('start-route', 'Lade Datei aus Storage', {
      jobId,
      itemId: src.itemId,
      parentId: src.parentId,
      fileName: src.name
    });
    
    let bin: Awaited<ReturnType<typeof provider.getBinary>>
    try {
      bin = await provider.getBinary(src.itemId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      
      // Versuche, HTTP-Response-Details aus dem Fehler zu extrahieren
      // StorageError kann httpStatus, httpStatusText und errorDetails enthalten
      const httpStatus = error && typeof error === 'object' && 'httpStatus' in error && typeof error.httpStatus === 'number'
        ? error.httpStatus
        : undefined
      const httpStatusText = error && typeof error === 'object' && 'httpStatusText' in error && typeof error.httpStatusText === 'string'
        ? error.httpStatusText
        : undefined
      const errorDetails = error && typeof error === 'object' && 'errorDetails' in error
        ? error.errorDetails
        : undefined
      
      // Versuche, errorCode aus dem Fehler zu extrahieren (StorageError hat code-Eigenschaft)
      const errorCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : (httpStatus === 500 ? 'file_load_error' : 'file_load_error')
      
      FileLogger.error('start-route', 'Fehler beim Laden der Datei aus Storage', {
        jobId,
        itemId: src.itemId,
        fileName: src.name,
        error: errorMessage,
        errorName,
        errorCode,
        httpStatus,
        httpStatusText,
        errorDetails
      })
      
      // Speichere detaillierte Fehlerinformationen im Job
      await repo.setStatus(jobId, 'failed', { 
        error: { 
          code: errorCode,
          message: errorMessage,
          details: {
            fileName: src.name,
            itemId: src.itemId,
            httpStatus,
            httpStatusText,
            errorDetails
          }
        } 
      })
      
      // Füge Fehler-Event zum Trace hinzu
      try {
        await repo.traceAddEvent(jobId, { 
          spanId: 'preprocess', 
          name: 'file_load_error', 
          level: 'error',
          message: errorMessage,
          attributes: {
            errorCode,
            fileName: src.name,
            itemId: src.itemId,
            httpStatus,
            httpStatusText,
            errorDetails: errorDetails && typeof errorDetails === 'object' ? errorDetails : undefined
          }
        })
      } catch {}
      
      return NextResponse.json({ 
        error: errorMessage,
        errorCode,
        details: {
          fileName: src.name,
          itemId: src.itemId,
          httpStatus,
          httpStatusText
        }
      }, { status: 500 })
    }
    
    const filename = src.name || 'document.pdf'
    const file = new File([bin.blob], filename, { type: src.mimeType || bin.mimeType || 'application/pdf' })
    
    FileLogger.info('start-route', 'Datei geladen', {
      jobId,
      fileName: filename,
      fileSize: file.size,
      fileType: file.type,
      blobSize: bin.blob.size
    });

    // Initialisiere Trace früh, damit Preprocess-Span nicht überschrieben wird
    try { await repo.initializeTrace(jobId) } catch {}

    // Shadow-Twin-State beim Job-Start analysieren und im Job-Dokument speichern
    // WICHTIG: Deterministische Erstellung des Shadow-Twin-Verzeichnisses, wenn benötigt
    // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
    let shadowTwinState: Awaited<ReturnType<typeof analyzeShadowTwin>> | null = null
    try {
      shadowTwinState = await analyzeShadowTwin(src.itemId, provider);
      if (shadowTwinState) {
        // Setze processingStatus auf 'processing', da Job gerade gestartet wird
        const mongoState = toMongoShadowTwinState({ ...shadowTwinState, processingStatus: 'processing' });
        await repo.setShadowTwinState(jobId, mongoState);
        FileLogger.info('start-route', 'Shadow-Twin-State analysiert und gespeichert', {
          jobId,
          fileId: src.itemId,
          hasTransformed: !!shadowTwinState.transformed,
          hasTranscriptFiles: !!shadowTwinState.transcriptFiles && shadowTwinState.transcriptFiles.length > 0,
          shadowTwinFolderId: shadowTwinState.shadowTwinFolderId
        });
      }
    } catch (error) {
      FileLogger.error('start-route', 'Fehler bei Shadow-Twin-Analyse', {
        jobId,
        fileId: src.itemId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }

    // Deterministische Erstellung des Shadow-Twin-Verzeichnisses, wenn benötigt
    // Prüfe Job-Parameter, ob Bilder verarbeitet werden sollen
    const opts = (job.correlation?.options || {}) as Record<string, unknown>
    const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native'
    const includeOcrImages = extractionMethod === 'mistral_ocr'
      ? (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true)
      : (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : false)
    const includePageImages = typeof opts['includePageImages'] === 'boolean' 
      ? opts['includePageImages'] 
      : (extractionMethod === 'mistral_ocr' ? true : false)
    const includeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    
    // Shadow-Twin-Verzeichnis wird benötigt, wenn Bilder verarbeitet werden sollen
    const needsShadowTwinFolder = includeOcrImages || includePageImages || includeImages
    
    // Wenn Verzeichnis benötigt wird, aber noch nicht existiert, erstelle es deterministisch
    if (needsShadowTwinFolder && !shadowTwinState?.shadowTwinFolderId) {
      try {
        const { findOrCreateShadowTwinFolder } = await import('@/lib/external-jobs/shadow-twin-helpers')
        const parentId = src.parentId || 'root'
        const originalName = src.name || 'output'
        const folderId = await findOrCreateShadowTwinFolder(provider, parentId, originalName, jobId)
        
        if (folderId) {
          // Aktualisiere Shadow-Twin-State im Job-Dokument
          // Jeder Job hat seinen eigenen isolierten State - keine Beeinflussung anderer Jobs
          const updatedState = shadowTwinState 
            ? { ...shadowTwinState, shadowTwinFolderId: folderId }
            : {
                baseItem: { id: src.itemId, metadata: { name: originalName } },
                shadowTwinFolderId: folderId,
                analysisTimestamp: Date.now()
              }
          
          const mongoState = toMongoShadowTwinState(updatedState)
          await repo.setShadowTwinState(jobId, mongoState)
          
          FileLogger.info('start-route', 'Shadow-Twin-Verzeichnis deterministisch erstellt', {
            jobId,
            folderId,
            parentId,
            originalName,
            reason: 'Bilder werden verarbeitet'
          });
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Erstellen des Shadow-Twin-Verzeichnisses', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
      }
    }

    // PreProcess vor dem Extract: Sichtbarkeit im Trace sicherstellen
    let pre: PreprocessResult | null = null
    const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
    try {
      await repo.traceStartSpan(jobId, { spanId: 'preprocess', parentSpanId: 'job', name: 'preprocess' })
      pre = await preprocess(ctxPre)
      await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'preprocess_summary', attributes: { hasMarkdown: pre.hasMarkdown, hasFrontmatter: pre.hasFrontmatter, frontmatterValid: pre.frontmatterValid } })
      await repo.traceEndSpan(jobId, 'preprocess', 'completed', {})
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Preprocessing', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Preprocessing-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
      // pre bleibt null, was bedeutet, dass Extract/Template ausgeführt werden müssen
    }

    const form = new FormData()
    form.append('file', file)
    // opts wurde bereits oben deklariert (Zeile 138) - verwende es hier direkt
    form.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de')
    form.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native')
    form.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true))
    // Für Standard-Endpoint: includeImages bleibt für Rückwärtskompatibilität
    // Für Mistral OCR wird es später zu includeOcrImages umbenannt
    const standardIncludeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    form.append('includeImages', String(standardIncludeImages))

    const appUrl = getPublicAppUrl()
    if (!appUrl) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'config_error', message: 'NEXT_PUBLIC_APP_URL fehlt' } })
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 })
    }
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
    try {
      await repo.initializeSteps(jobId, [
        { name: 'extract_pdf', status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ], job.parameters)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Initialisieren der Steps', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'steps_init_error', message: 'Fehler beim Initialisieren der Steps' } })
      return NextResponse.json({ error: 'Fehler beim Initialisieren der Steps' }, { status: 500 })
    }
    // Status wird erst nach erfolgreichem Request gesetzt (siehe Zeile 477)
    await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'process_pdf_submit', attributes: {
      libraryId: job.libraryId,
      fileName: filename,
      extractionMethod: opts['extractionMethod'] ?? job.correlation?.options?.extractionMethod ?? undefined,
      targetLanguage: opts['targetLanguage'] ?? job.correlation?.options?.targetLanguage ?? undefined,
      includeOcrImages: opts['includeOcrImages'] ?? job.correlation?.options?.includeOcrImages ?? undefined,
      includePageImages: opts['includePageImages'] ?? job.correlation?.options?.includePageImages ?? undefined,
      includeImages: opts['includeImages'] ?? job.correlation?.options?.includeImages ?? undefined, // Rückwärtskompatibilität
      useCache: opts['useCache'] ?? job.correlation?.options?.useCache ?? undefined,
      template: (job.parameters as Record<string, unknown> | undefined)?.['template'] ?? undefined,
      phases: (job.parameters as Record<string, unknown> | undefined)?.['phases'] ?? undefined,
    } })

    form.append('callback_url', callbackUrl)

    // Entscheidungslogik: Ingest-only, wenn Shadow‑Twin + gültiges FM vorhanden und Phasen es erlauben
    const phases = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { extract?: boolean; template?: boolean; ingest?: boolean } }).phases : undefined
    const extractEnabled = phases?.extract !== false
    const templateEnabled = phases?.template !== false
    const ingestEnabled = phases?.ingest !== false
    const needExtract = !(pre && pre.hasMarkdown)
    const needTemplate = !(pre && pre.hasFrontmatter && pre.frontmatterValid)
    const runExtract = extractEnabled && needExtract
    const runTemplate = templateEnabled && needTemplate
    const runIngestOnly = ingestEnabled && !runExtract && !runTemplate

    if (runIngestOnly) {
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_has_markdown' } }) } catch {}
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_frontmatter_valid' } }) } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}

      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const twinName = `${baseName}.${lang}.md`
      const parentId = job.correlation?.source?.parentId || 'root'
      const originalName = job.correlation.source?.name || 'output'
      
      // Erweiterte Shadow-Twin-Suche: Zuerst Verzeichnis prüfen, dann Datei
      let twin: { id: string } | undefined
      
      // 1. Prüfe auf Shadow-Twin-Verzeichnis
      const shadowTwinFolder = await findShadowTwinFolder(parentId, originalName, provider)
      if (shadowTwinFolder) {
        // Markdown-Datei im Verzeichnis finden
        const markdownInFolder = await findShadowTwinMarkdown(shadowTwinFolder.id, baseName, lang, provider)
        if (markdownInFolder) {
          twin = { id: markdownInFolder.id }
        }
      }
      
      // 2. Wenn kein Verzeichnis gefunden: Shadow-Twin-Datei wie bisher suchen
      if (!twin) {
      const siblings = await provider.listItemsById(parentId)
        twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === twinName) as { id: string } | undefined
      }
      
      if (!twin) {
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'Shadow‑Twin nicht gefunden' } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'shadow_twin_missing', message: 'Shadow‑Twin nicht gefunden' } })
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }
      
      const bin2 = await provider.getBinary(twin.id)
      const markdownText = await bin2.blob.text()
      const parsed = parseSecretaryMarkdownStrict(markdownText)
      const meta = (parsed?.meta && typeof parsed.meta === 'object') ? (parsed.meta as Record<string, unknown>) : {}
      const ctx2: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      try {
        const res = await runIngestion({ ctx: ctx2, savedItemId: twin.id, fileName: twinName, markdown: markdownText, meta: meta as unknown as import('@/types/external-jobs').Frontmatter })
        const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_pinecone_upserted', attributes: { chunks: res.chunksUpserted, doc: res.docUpserted, total, vectorFileId: twin.id } }) } catch {}
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_doc_id', attributes: { vectorFileId: twin.id, fileName: twinName } }) } catch {}
        await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() })
        const completed = await setJobCompleted({ ctx: ctx2, result: { savedItemId: twin.id } })
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'ingest_only' })
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: reason } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'ingestion_failed', message: reason } })
        return NextResponse.json({ error: reason }, { status: 500 })
      }
    }

    // Template-only: vorhandenes Markdown nutzen, Frontmatter reparieren lassen
    if (!runExtract && runTemplate) {
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const twinName = `${baseName}.${lang}.md`
      const parentId = job.correlation?.source?.parentId || 'root'
      const originalName = job.correlation.source?.name || 'output'
      
      // Erweiterte Shadow-Twin-Suche: Zuerst Verzeichnis prüfen, dann Datei
      let twin: { id: string } | undefined
      
      // 1. Prüfe auf Shadow-Twin-Verzeichnis
      const shadowTwinFolder = await findShadowTwinFolder(parentId, originalName, provider)
      if (shadowTwinFolder) {
        // Markdown-Datei im Verzeichnis finden
        const markdownInFolder = await findShadowTwinMarkdown(shadowTwinFolder.id, baseName, lang, provider)
        if (markdownInFolder) {
          twin = { id: markdownInFolder.id }
        }
      }
      
      // 2. Wenn kein Verzeichnis gefunden: Shadow-Twin-Datei wie bisher suchen
      if (!twin) {
      const siblings = await provider.listItemsById(parentId)
        twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === twinName) as { id: string } | undefined
      }
      
      if (!twin) return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      const bin2 = await provider.getBinary(twin.id)
      const markdownText = await bin2.blob.text()
      const parsed = parseSecretaryMarkdownStrict(markdownText) as unknown as { body?: string }
      const bodyOnly = typeof parsed?.body === 'string' ? parsed.body as string : markdownText

      // interner Callback mit extracted_text → Orchestrator führt Template/Save/Ingest aus
      const internalToken = process.env.INTERNAL_TEST_TOKEN || ''
      const cbRes = await fetch(`${getPublicAppUrl().replace(/\/$/, '')}/api/external/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(internalToken ? { 'X-Internal-Token': internalToken } : {}) },
        body: JSON.stringify({ data: { extracted_text: bodyOnly } })
      })
      if (!cbRes.ok) return NextResponse.json({ error: 'Template-Only Callback fehlgeschlagen', status: cbRes.status }, { status: 502 })
      return NextResponse.json({ ok: true, jobId, kind: 'template_only' })
    }

    // Secretary-Flow (Extract/Template)
    const secret = (await import('crypto')).randomBytes(24).toString('base64url')
    const secretHash = repo.hashSecret(secret)
    // WICHTIG: Hash SOFORT im Job speichern, BEVOR der Request gesendet wird
    // Dies stellt sicher, dass Callbacks vom Secretary Service korrekt validiert werden können
    // Der Hash muss verfügbar sein, bevor der Secretary Service den Callback sendet
    try {
      await repo.setStatus(jobId, 'running', { jobSecretHash: secretHash })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Setzen des Status und Hash', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'status_update_error', message: 'Fehler beim Setzen des Status' } })
      return NextResponse.json({ error: 'Fehler beim Setzen des Status' }, { status: 500 })
    }
    form.append('callback_token', secret)

    const { baseUrl, apiKey } = getSecretaryConfig()
    if (!apiKey) return NextResponse.json({ error: 'SECRETARY_SERVICE_API_KEY fehlt' }, { status: 500 })
    
    // Entscheidungslogik: Mistral OCR verwendet eigenen Endpoint
    // extractionMethod wurde bereits oben deklariert (Zeile 139) - verwende es hier direkt
    
    // Für Mistral OCR: Beide Parameter standardmäßig auf true setzen
    // includeOcrImages: Mistral OCR Bilder als Base64 (in mistral_ocr_raw.pages[*].images[*].image_base64)
    // includePageImages: Seiten-Bilder als ZIP (parallel extrahiert)
    // includeOcrImages und includePageImages wurden bereits oben deklariert (Zeile 140-145) - verwende sie hier direkt
    
    FileLogger.info('start-route', 'Starte PDF-Transformation', {
      jobId,
      extractionMethod,
      includeOcrImages,
      useCache: typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true,
      fileName: filename,
      baseUrl
    });
    
    let url: string
    let formForRequest: FormData
    
    if (extractionMethod === 'mistral_ocr') {
      // Verwende neuen Mistral OCR Endpoint
      // baseUrl kann mit oder ohne /api enden - normalisiere es
      const normalizedBaseUrl = baseUrl.replace(/\/$/, ''); // Entferne trailing slash
      // Wenn baseUrl bereits /api enthält, verwende nur /pdf/process-mistral-ocr
      // Sonst füge /api/pdf/process-mistral-ocr hinzu
      const endpoint = normalizedBaseUrl.endsWith('/api') 
        ? '/pdf/process-mistral-ocr'
        : '/api/pdf/process-mistral-ocr';
      url = `${normalizedBaseUrl}${endpoint}`
      
      // includePageImages wurde bereits oben deklariert (Zeile 143-145) - verwende es hier direkt
      
      FileLogger.info('start-route', 'Verwende Mistral OCR Endpoint', {
        jobId,
        url,
        includeOcrImages,
        includePageImages
      });
      
      // Erstelle neuen FormData mit Mistral OCR spezifischen Parametern
      // Laut Dokumentation: includeOcrImages → includeImages (Mistral OCR Base64), includePageImages (Seiten-ZIP)
      formForRequest = new FormData()
      formForRequest.append('file', file)
      formForRequest.append('includeImages', String(includeOcrImages)) // Mistral OCR Bilder als Base64 (Secretary Service erwartet includeImages)
      formForRequest.append('includePageImages', String(includePageImages)) // Seiten-Bilder als ZIP (parallel)
      formForRequest.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true))
      formForRequest.append('callback_url', callbackUrl)
      formForRequest.append('callback_token', secret)
      
      // Optional: page_start und page_end falls vorhanden
      if (typeof opts['page_start'] === 'number') {
        formForRequest.append('page_start', String(opts['page_start']))
      }
      if (typeof opts['page_end'] === 'number') {
        formForRequest.append('page_end', String(opts['page_end']))
      }
      
      // Debug: Logge alle FormData-Einträge
      const formDataEntries: Record<string, string> = {}
      formForRequest.forEach((value, key) => {
        if (value instanceof File) {
          formDataEntries[key] = `File(${value.name}, ${value.size} bytes)`
        } else {
          formDataEntries[key] = String(value)
        }
      })
      
      FileLogger.info('start-route', 'Mistral OCR FormData erstellt', {
        jobId,
        hasFile: !!file,
        fileName: file.name,
        fileSize: file.size,
        formDataEntries, // Alle FormData-Einträge loggen
        includeOcrImages: String(includeOcrImages),
        includePageImages: String(includePageImages),
        useCache: String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true),
        callbackUrl
      });
      
      // Kein template Parameter für Mistral OCR Endpoint
      // Kein extraction_method Parameter (ist immer Mistral OCR)
    } else {
      // Verwende Standard PDF Process Endpoint
      // baseUrl kann mit oder ohne /api enden - normalisiere es
      const normalizedBaseUrl = baseUrl.replace(/\/$/, ''); // Entferne trailing slash
      // Wenn baseUrl bereits /api enthält, verwende nur /pdf/process
      // Sonst füge /api/pdf/process hinzu
      const endpoint = normalizedBaseUrl.endsWith('/api')
        ? '/pdf/process'
        : '/api/pdf/process';
      url = `${normalizedBaseUrl}${endpoint}`
      formForRequest = form // Verwende bestehenden FormData
      
      FileLogger.info('start-route', 'Verwende Standard PDF Process Endpoint', {
        jobId,
        url
      });
    }
    
    const headers: Record<string, string> = { 'x-worker': 'true', 'Authorization': `Bearer ${apiKey}`, 'X-Service-Token': apiKey }
    
    FileLogger.info('start-route', 'Sende Request an Secretary Service', {
      jobId,
      url,
      method: 'POST',
      hasApiKey: !!apiKey
    });
    
    let resp: Response
    try {
      resp = await fetch(url, { method: 'POST', body: formForRequest, headers })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Senden des Requests an Secretary Service', {
        jobId,
        url,
        error: error instanceof Error ? error.message : String(error)
      })
      await repo.setStatus(jobId, 'failed', { error: { code: 'fetch_error', message: 'Fehler beim Senden des Requests' } })
      return NextResponse.json({ error: 'Fehler beim Senden des Requests' }, { status: 500 })
    }
    
    FileLogger.info('start-route', 'Secretary Service Antwort erhalten', {
      jobId,
      status: resp.status,
      statusText: resp.statusText,
      ok: resp.ok,
      headers: Object.fromEntries(resp.headers.entries())
    });
    
    try {
      await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'request_ack', attributes: { status: resp.status, statusText: resp.statusText, url, extractionMethod } })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Hinzufügen des Trace-Events', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Trace-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    // Status wurde bereits VOR dem Request gesetzt (siehe Zeile 360)
    // Hash wurde bereits gespeichert, damit Callbacks korrekt validiert werden können
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Keine Fehlermeldung');
      FileLogger.error('start-route', 'Secretary Service Fehler', {
        jobId,
        status: resp.status,
        statusText: resp.statusText,
        errorText,
        url
      });
      await repo.setStatus(jobId, 'failed', { error: { code: 'secretary_error', message: errorText, details: { status: resp.status, statusText: resp.statusText } } })
      return NextResponse.json({ error: 'Secretary Fehler', status: resp.status, details: errorText }, { status: 502 })
    }
    const data = await resp.json().catch((err) => {
      FileLogger.error('start-route', 'Fehler beim Parsen der Response', {
        jobId,
        error: err instanceof Error ? err.message : String(err)
      });
      return {};
    })
    
    FileLogger.info('start-route', 'Secretary Service Response erfolgreich', {
      jobId,
      hasData: !!data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      status: (data as { status?: string })?.status
    });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 0, updatedAt: new Date().toISOString(), message: 'enqueued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
    // Watchdog wurde bereits beim Start gestartet - nur aktualisieren (bump)
    // Dies stellt sicher, dass der Timer zurückgesetzt wird, wenn der Request erfolgreich war
    try {
      bumpWatchdog(jobId, 600_000)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Aktualisieren des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Watchdog-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    return NextResponse.json({ ok: true, jobId, data })
  } catch (err) {
    // WICHTIG: Bei Fehlern Status auf 'failed' setzen, damit Job nicht hängen bleibt
    const errorMessage = err instanceof Error ? err.message : 'Unerwarteter Fehler'
    FileLogger.error('start-route', 'Fehler beim Starten des Jobs', {
      jobId,
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined
    })
    try {
      await repo.setStatus(jobId, 'failed', { error: { code: 'start_error', message: errorMessage } })
    } catch (statusError) {
      FileLogger.error('start-route', 'Fehler beim Setzen des Status', {
        jobId,
        error: statusError instanceof Error ? statusError.message : String(statusError)
      })
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


