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
import { getPublicAppUrl } from '@/lib/env'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { startWatchdog, bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog'
import type { RequestContext } from '@/types/external-jobs'
import { preprocessorPdfExtract } from '@/lib/external-jobs/preprocessor-pdf-extract'
import { preprocessorTransformTemplate } from '@/lib/external-jobs/preprocessor-transform-template'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { isInternalAuthorized } from '@/lib/external-jobs/auth'
import { FileLogger } from '@/lib/debug/logger'
import { checkJobStartability } from '@/lib/external-jobs/job-status-check'
import { prepareSecretaryRequest } from '@/lib/external-jobs/secretary-request'
import { tracePreprocessEvents } from '@/lib/external-jobs/trace-helpers'
import { handleJobError } from '@/lib/external-jobs/error-handler'
import { analyzeShadowTwinWithService } from '@/lib/shadow-twin/analyze-shadow-twin'
import { toMongoShadowTwinState } from '@/lib/shadow-twin/shared'
import { gateExtractPdf } from '@/lib/processing/gates'
import { getPolicies, shouldRunExtract } from '@/lib/processing/phase-policy'
import type { Library, LibraryChatConfig } from '@/types/library'
import { LibraryService } from '@/lib/services/library-service'
import { loadShadowTwinMarkdown } from '@/lib/external-jobs/phase-shadow-twin-loader'
import { runIngestPhase } from '@/lib/external-jobs/phase-ingest'
import { runTemplatePhase } from '@/lib/external-jobs/phase-template'
import { readPhasesAndPolicies } from '@/lib/external-jobs/policies'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { withRequestStorageCache } from '@/lib/storage/provider-request-cache'

/**
 * Ableitung des Extract-Gates aus einem bereits berechneten ShadowTwinState.
 *
 * Ziel: doppelte Storage-Scans (findShadowTwinFolder/listItemsById) vermeiden, wenn wir die
 * Information ohnehin schon aus `analyzeShadowTwin()` haben.
 *
 * WICHTIG: Diese Ableitung deckt den häufigsten Fall ab:
 * - wenn im Shadow-Twin-Verzeichnis bereits ein Transcript oder Transformiertes Markdown existiert,
 *   dann ist Extract redundant.
 * Falls ShadowTwinState nicht aussagekräftig ist, geben wir `undefined` zurück und fallen auf
 * `gateExtractPdf()` zurück.
 */
function deriveExtractGateFromShadowTwinState(
  shadowTwinState: unknown,
  targetLanguage: string | undefined
): { exists: boolean; reason?: 'shadow_twin_exists'; details?: Record<string, unknown> } | undefined {
  try {
    if (!shadowTwinState || typeof shadowTwinState !== 'object') return undefined
    const st = shadowTwinState as {
      shadowTwinFolderId?: unknown
      transformed?: unknown
      transcriptFiles?: unknown
    }
    const folderId = typeof st.shadowTwinFolderId === 'string' ? st.shadowTwinFolderId : undefined

    const transformed = (st.transformed && typeof st.transformed === 'object')
      ? (st.transformed as { id?: unknown; metadata?: { name?: unknown } })
      : undefined
    const transformedId = typeof transformed?.id === 'string' ? transformed.id : undefined
    const transformedName = typeof transformed?.metadata?.name === 'string' ? transformed.metadata.name : undefined

    const transcriptFiles = Array.isArray(st.transcriptFiles) ? st.transcriptFiles as Array<{ id?: unknown; metadata?: { name?: unknown } }> : []
    const transcript = transcriptFiles.find(f => typeof f?.id === 'string')
    const transcriptId = typeof transcript?.id === 'string' ? transcript.id : undefined
    const transcriptName = typeof transcript?.metadata?.name === 'string' ? transcript.metadata.name : undefined

    // Ohne irgendein Markdown ist die Aussage "shadow_twin_exists" nicht belastbar
    if (!transformedId && !transcriptId) return { exists: false }

    return {
      exists: true,
      reason: 'shadow_twin_exists',
      details: {
        source: 'shadowTwinState',
        folderId: folderId || null,
        language: (targetLanguage || 'de').toLowerCase(),
        transformed: transformedId ? { id: transformedId, name: transformedName || null } : null,
        transcript: transcriptId ? { id: transcriptId, name: transcriptName || null } : null,
      },
    }
  } catch {
    return undefined
  }
}

function getExtractStepName(jobType: string): 'extract_pdf' | 'extract_audio' | 'extract_video' {
  if (jobType === 'audio') return 'extract_audio'
  if (jobType === 'video') return 'extract_video'
  return 'extract_pdf'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const repo = new ExternalJobsRepository();
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
    // Duplicate-Detection (nur Logging, kein Blockieren):
    // Wir wollen doppelte /start Requests erkennen und Ursachen finden, statt hart zu blockieren.
    const startability = checkJobStartability(job)
    const startRequestId = request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || null
    const workerIdFromHeader = request.headers.get('x-worker-id') || null
    if (!startability.canStart) {
      FileLogger.warn('start-route', 'Start-Request erneut erhalten (nicht blockiert)', {
        jobId,
        reason: startability.reason || 'already_started',
        jobStatus: job.status,
        workerId: workerIdFromHeader,
        startRequestId,
        pid: process.pid,
      })
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'job',
          name: 'start_duplicate_request',
          level: 'warn',
          attributes: {
            reason: startability.reason || 'already_started',
            jobStatus: job.status,
            workerId: workerIdFromHeader,
            startRequestId,
            pid: process.pid,
          },
        })
      } catch {}
    }
    
    // Erlaube Neustart, wenn Job fehlgeschlagen ist
    const isFailed = job.status === 'failed'
    // Wenn Job fehlgeschlagen ist, lösche processId, damit neue Callbacks akzeptiert werden
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

    // Request-lokales Caching für Storage-Reads aktivieren (reduziert redundante list/get/path Calls)
    provider = withRequestStorageCache(provider)
    
    FileLogger.info('start-route', 'Lade Datei aus Storage', {
      jobId,
      itemId: src.itemId,
      parentId: src.parentId,
      fileName: src.name
    });
    
    let bin: Awaited<ReturnType<typeof provider.getBinary>>
    try {
      FileLogger.info('start-route', 'Starte getBinary-Aufruf', {
        jobId,
        itemId: src.itemId,
        fileName: src.name
      })
      bin = await provider.getBinary(src.itemId)
      FileLogger.info('start-route', 'getBinary erfolgreich abgeschlossen', {
        jobId,
        itemId: src.itemId,
        fileName: src.name,
        blobSize: bin.blob.size,
        mimeType: bin.mimeType
      })
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
    let libraryForShadowTwin: Awaited<ReturnType<typeof LibraryService.getInstance>['getLibrary']> = null
    FileLogger.info('start-route', 'Starte Shadow-Twin-Analyse', {
      jobId,
      itemId: src.itemId,
      fileName: src.name
    })
    let shadowTwinState: Awaited<ReturnType<typeof analyzeShadowTwinWithService>> | null = null
    try {
      // WICHTIG:
      // Wir analysieren Shadow-Twins Mongo-aware (via ShadowTwinService), weil `primaryStore=mongo`
      // in vielen Libraries aktiv ist. Ohne das würden wir Mongo-Artefakte über den Provider "übersehen".
      libraryForShadowTwin = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
      const lang = (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage || 'de'
      shadowTwinState = await analyzeShadowTwinWithService(src.itemId, provider, job.userEmail, libraryForShadowTwin, lang)
      FileLogger.info('start-route', 'Shadow-Twin-Analyse abgeschlossen', {
        jobId,
        itemId: src.itemId,
        hasShadowTwinFolder: !!shadowTwinState?.shadowTwinFolderId,
        hasTransformed: !!shadowTwinState?.transformed
      })
      if (shadowTwinState) {
        // Setze processingStatus auf 'processing', da Job gerade gestartet wird
        const mongoState = toMongoShadowTwinState({ ...shadowTwinState, processingStatus: 'processing' });
        await repo.setShadowTwinState(jobId, mongoState);
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
    // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
    const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'mistral_ocr'
    const includeOcrImages = extractionMethod === 'mistral_ocr'
      ? (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true)
      : (typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : false)
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = typeof opts['includePageImages'] === 'boolean' 
      ? opts['includePageImages'] 
      : (extractionMethod === 'mistral_ocr' ? true : false)
    const includeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    
    // Shadow-Twin-Verzeichnis wird benötigt, wenn Bilder verarbeitet werden sollen
    const needsShadowTwinFolder = includeOcrImages || includePageImages || includeImages
    
    // Prüfe Shadow-Twin-Konfiguration: Verzeichnis nur erstellen, wenn persistToFilesystem=true
    const shadowTwinConfig = getShadowTwinConfig(libraryForShadowTwin)
    const shouldCreateFolder = needsShadowTwinFolder && shadowTwinConfig.persistToFilesystem
    
    // Wenn Verzeichnis benötigt wird, aber noch nicht existiert, erstelle es deterministisch
    // ABER: Nur wenn persistToFilesystem=true (bei MongoDB-only wird kein Verzeichnis erstellt)
    if (shouldCreateFolder && !shadowTwinState?.shadowTwinFolderId) {
      try {
        const parentId = src.parentId || 'root'
        const originalName = src.name || 'output'
        const folderName = generateShadowTwinFolderName(originalName)

        // OPTIMIERUNG: Wir haben eben `analyzeShadowTwinWithService()` gemacht und wissen, dass kein Folder existiert.
        // Daher erzeugen wir deterministisch direkt, ohne nochmal `findShadowTwinFolder()` aufzurufen.
        // Falls zwischenzeitlich ein Folder entstanden ist, fällt `createFolder` ggf. fehl → dann fallback.
        let folderId: string | undefined
        try {
          const created = await provider.createFolder(parentId, folderName)
          folderId = created.id
        } catch {
          // Fallback: existierendes Verzeichnis finden/holen (robust gegen Race Conditions)
          const { findOrCreateShadowTwinFolder } = await import('@/lib/external-jobs/shadow-twin-helpers')
          folderId = await findOrCreateShadowTwinFolder(provider, parentId, originalName, jobId)
        }
        
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

          // Auch lokal aktualisieren, damit spätere Checks (Gates/Decisions) den neuen Zustand sehen
          shadowTwinState = updatedState as typeof shadowTwinState
          
          FileLogger.info('start-route', 'Shadow-Twin-Verzeichnis deterministisch erstellt', {
            jobId,
            folderId,
            parentId,
            originalName,
            reason: 'Bilder werden verarbeitet',
            persistToFilesystem: shadowTwinConfig.persistToFilesystem
          });
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Erstellen des Shadow-Twin-Verzeichnisses', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
      }
    } else if (needsShadowTwinFolder && !shadowTwinConfig.persistToFilesystem) {
      // Bilder werden verarbeitet, aber persistToFilesystem=false - kein Verzeichnis erstellen
      FileLogger.info('start-route', 'Shadow-Twin-Verzeichnis wird nicht erstellt (persistToFilesystem=false)', {
        jobId,
        originalName: src.name || 'output',
        reason: 'Bilder werden direkt nach Azure/MongoDB hochgeladen, kein Filesystem-Verzeichnis benötigt',
        primaryStore: shadowTwinConfig.primaryStore
      });
    }

    const extractStepName = getExtractStepName(job.job_type)

    // Phasen-spezifische Preprozessoren aufrufen (bauen auf derselben Storage/Library-Logik auf)
    // WICHTIG: Die Preprozessoren sind aktuell PDF-spezifisch (findPdfMarkdown).
    // Für Audio/Video laufen die Entscheidungen primär über Gate + ShadowTwinState.
    const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
    let preExtractResult: Awaited<ReturnType<typeof preprocessorPdfExtract>> | null = null
    let preTemplateResult: Awaited<ReturnType<typeof preprocessorTransformTemplate>> | null = null
    if (job.job_type === 'pdf') {
    try {
      preExtractResult = await preprocessorPdfExtract(ctxPre)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler im preprocessorPdfExtract', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    try {
      preTemplateResult = await preprocessorTransformTemplate(ctxPre)
    } catch (error) {
      FileLogger.error('start-route', 'Fehler im preprocessorTransformTemplate', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      }
    }

    // Trace-Events für Preprocess aus Template-Preprozessor ableiten (für Validatoren/Debugging)
    await tracePreprocessEvents(jobId, preExtractResult, preTemplateResult, repo)

    const appUrl = getPublicAppUrl()
    if (!appUrl) {
      await repo.setStatus(jobId, 'failed', { error: { code: 'config_error', message: 'NEXT_PUBLIC_APP_URL fehlt' } })
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 })
    }
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
    try {
      await repo.initializeSteps(jobId, [
        { name: extractStepName, status: 'pending' },
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
    await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: job.job_type === 'pdf' ? 'process_pdf_submit' : 'process_submit', attributes: {
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
      // Duplicate-Diagnose:
      startRequestId: request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || undefined,
      workerId: request.headers.get('x-worker-id') || undefined,
      workerTickId: request.headers.get('x-worker-tick-id') || undefined,
      pid: process.pid,
    } })

    // Entscheidungslogik: Gate-basierte Prüfung für Extract-Phase
    // 1. Policies extrahieren
    const policies = getPolicies({ parameters: job.parameters })
    
    // 2. Gate für Extract-Phase prüfen (Shadow-Twin existiert?)
    let extractGateExists = false
    let extractGateReason: string | undefined
    let library: Library | undefined
    try {
      // Library-Informationen für Gate benötigt
      const libraryService = LibraryService.getInstance()
      const libraries = await libraryService.getUserLibraries(job.userEmail)
      library = libraries.find(l => l.id === job.libraryId) as Library | undefined
      
      if (!library) {
        FileLogger.warn('start-route', 'Library nicht gefunden für Gate-Prüfung', {
          jobId,
          libraryId: job.libraryId,
          userEmail: job.userEmail
        })
      } else {
        const derivedGate = deriveExtractGateFromShadowTwinState(
          shadowTwinState,
          (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage
        )
        const gateResult = derivedGate ?? await gateExtractPdf({
          repo,
          jobId,
          userEmail: job.userEmail,
          library,
          source: job.correlation?.source,
          options: {
            ...(job.correlation?.options as { targetLanguage?: string } | undefined),
            templateName: (job.parameters as { template?: unknown } | undefined)?.template as string | undefined,
          },
          provider,
        })
        
        if (gateResult.exists) {
          extractGateExists = true
          extractGateReason = gateResult.reason || 'shadow_twin_exists'
        }
      }
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Prüfen des Extract-Gates', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // Bei Fehler: Gate-Prüfung überspringen, normale Logik verwenden
      // extractGateExists bleibt false, was bedeutet, dass Extract ausgeführt wird
    }
    
    // 3. Entscheidung: Soll Extract ausgeführt werden?
    // Kombiniere Gate-Prüfung mit Policy-Logik
    const phases = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { extract?: boolean; template?: boolean; ingest?: boolean } }).phases : undefined
    const extractEnabled = phases?.extract !== false
    const templateEnabled = phases?.template !== false
    const ingestEnabled = phases?.ingest !== false
    
    // Policy-Directive für Extract bestimmen
    // Mapping: 'force' → 'force', 'skip'/'auto' → 'do' (Gate respektieren), 'ignore' → 'ignore'
    const extractDirective: 'ignore' | 'do' | 'force' = 
      policies.extract === 'force' ? 'force' :
      policies.extract === 'ignore' ? 'ignore' :
      extractEnabled ? 'do' : 'ignore'
    
    // Gate-basierte Entscheidung: Soll Extract ausgeführt werden?
    // shouldRunExtract() kombiniert bereits Gate-Ergebnis mit Policy-Directive
    // - 'force' → immer true (Gate wird ignoriert)
    // - 'ignore' → immer false
    // - 'do' → !gateExists (Gate wird respektiert)
    const shouldRunExtractPhase = shouldRunExtract(extractGateExists, extractDirective)
    
    // Preprocess/Preprozessoren als Quelle für Entscheidungen verwenden
    const needTemplate = preTemplateResult ? preTemplateResult.needTemplate : true
    
    // Finale Entscheidung: Extract nur wenn Phase enabled UND Gate/Policy es erlaubt
    // WICHTIG: shouldRunExtractPhase ist bereits die finale Gate+Policy-Entscheidung
    const runExtract = extractEnabled && shouldRunExtractPhase
    const runTemplate = templateEnabled && needTemplate
    
    // Prüfe, ob Template übersprungen werden sollte (z.B. chapters_already_exist)
    // Dies kann passieren, wenn eine transformierte Datei bereits im Shadow-Twin existiert
    // oder wenn Template-Step bereits als skipped markiert wurde
    let templateWillBeSkipped = false
    if (templateEnabled && !runTemplate) {
      // Template wird nicht ausgeführt (needTemplate = false)
      templateWillBeSkipped = true
    } else if (templateEnabled && runTemplate) {
      // Prüfe, ob Template-Step bereits als skipped markiert wurde (z.B. durch Preprocessor)
      try {
        const currentStep = job.steps?.find(s => s?.name === 'transform_template')
        if (currentStep?.status === 'completed' && currentStep?.details && typeof currentStep.details === 'object' && 'skipped' in currentStep.details) {
          templateWillBeSkipped = true
        }
      } catch {}
      
      // Prüfe, ob bereits eine transformierte Datei im Shadow-Twin existiert
      // Dies bedeutet, dass Template übersprungen werden sollte (chapters_already_exist)
      if (!templateWillBeSkipped && shadowTwinState?.transformed) {
        templateWillBeSkipped = true
      }
    }
    
    // Ingestion-only: Wenn Extract übersprungen UND (Template übersprungen ODER Template wird übersprungen)
    // WICHTIG: Wenn eine transformierte Datei bereits existiert, bedeutet das, dass Template übersprungen wird
    const runIngestOnly = ingestEnabled && !runExtract && (!runTemplate || templateWillBeSkipped)
    
    // Wenn Template nicht ausgeführt werden soll, aber Phase enabled ist, Step als skipped markieren
    // Dies passiert, wenn der Template-Preprozessor needTemplate === false liefert (Frontmatter valide)
    let templateSkipReason: string | undefined = undefined
    if (templateEnabled && !runTemplate) {
      // v2-only: Keine Legacy-Adoption/Reparatur in Phase A.
      // Wenn v2-Artefakte fehlen, soll das bewusst sichtbar bleiben.
      templateSkipReason = 'preprocess_frontmatter_valid'
      
      try {
        await repo.updateStep(jobId, 'transform_template', {
          status: 'completed',
          endedAt: new Date(),
          details: { skipped: true, reason: templateSkipReason, needTemplate: false },
        })
      } catch {}
    }
    
    // Logging nur bei unerwarteten Situationen (z.B. Gate gefunden, aber trotzdem ausgeführt)
    
    // Wenn Gate gefunden wurde, aber trotzdem ausgeführt wird (z.B. force), logge Warnung
    if (extractGateExists && runExtract && extractDirective !== 'force') {
      FileLogger.warn('start-route', 'Extract wird ausgeführt trotz vorhandenem Shadow-Twin', {
        jobId,
        extractGateExists,
        extractDirective,
        shouldRunExtractPhase
      })
    }

    if (runIngestOnly) {
      try { await repo.updateStep(jobId, extractStepName, { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_has_markdown' } }) } catch {}
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_frontmatter_valid' } }) } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}

      const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }

      // Shadow-Twin-Markdown-Datei laden (v2-only)
      const shadowTwinData = await loadShadowTwinMarkdown(ctxPre, provider)
      if (!shadowTwinData) {
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'Shadow‑Twin nicht gefunden' } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'shadow_twin_missing', message: 'Shadow‑Twin nicht gefunden' } })
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }
      
      // Policies lesen
      const phasePolicies = readPhasesAndPolicies(job.parameters)

      // Ingest-Phase ausführen
      const ctx2: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      const ingestResult = await runIngestPhase({
        ctx: ctx2,
        provider,
        repo,
        markdown: shadowTwinData.markdown,
        meta: shadowTwinData.meta,
        savedItemId: shadowTwinData.fileId,
        policies: { ingest: phasePolicies.ingest as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
      })

      if (ingestResult.error) {
        await repo.setStatus(jobId, 'failed', { error: { code: 'ingestion_failed', message: ingestResult.error } })
        return NextResponse.json({ error: ingestResult.error }, { status: 500 })
      }

      if (ingestResult.completed) {
        // Shadow-Twin-State aktualisieren: processingStatus auf 'ready' setzen
        // Ingest-Only: Nach erfolgreicher Ingestion ist der Shadow-Twin vollständig
        try {
          const updatedJob = await repo.get(jobId)
          if (updatedJob?.shadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...updatedJob.shadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
            FileLogger.info('start-route', 'Shadow-Twin-State nach Ingestion auf ready gesetzt', { jobId })
          }
        } catch (error) {
          FileLogger.error('start-route', 'Fehler beim Aktualisieren des Shadow-Twin-States nach Ingestion', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
          // Fehler nicht kritisch - Job kann trotzdem abgeschlossen werden
        }
        
        const completed = await setJobCompleted({ ctx: ctx2, result: { savedItemId: shadowTwinData.fileId } })
        getJobEventBus().emitUpdate(job.userEmail, { 
          type: 'job_update', 
          jobId, 
          status: 'completed', 
          progress: 100, 
          updatedAt: new Date().toISOString(), 
          message: 'completed', 
          jobType: job.job_type, 
          fileName: job.correlation?.source?.name, 
          sourceItemId: job.correlation?.source?.itemId, 
          libraryId: job.libraryId,
          result: { savedItemId: shadowTwinData.fileId },
          shadowTwinFolderId: job.shadowTwinState?.shadowTwinFolderId || null,
        })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'ingest_only' })
      }

      return NextResponse.json({ ok: true, jobId, kind: 'ingest_only', skipped: ingestResult.skipped })
    }

    // Template-only: vorhandenes Markdown nutzen, Frontmatter reparieren lassen
    if (!runExtract && runTemplate) {
      // Markiere Extract-Step als skipped, wenn Extract übersprungen wurde (Gate oder Phase deaktiviert)
      // WICHTIG: Dies muss auch hier passieren, wenn Template ausgeführt wird
      try {
        await repo.updateStep(jobId, extractStepName, {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // WICHTIG: Job-Objekt neu laden, damit shadowTwinState sicher vorhanden ist.
      // Ohne Reload sieht loadShadowTwinMarkdown u.U. kein shadowTwinState und sucht "blind" im Storage.
      const refreshedJob = await repo.get(jobId)

      // Shadow-Twin-Markdown-Datei laden (bevorzugt shadowTwinState.transformed.id)
      const ctxPre: RequestContext = { request, jobId, job: refreshedJob || job, body: {}, callbackToken: undefined, internalBypass: true }
      const shadowTwinData = await loadShadowTwinMarkdown(ctxPre, provider)
      if (!shadowTwinData) {
        // Job als failed markieren, da Shadow-Twin nicht gefunden wurde
        try {
          await repo.updateStep(jobId, 'transform_template', {
            status: 'failed',
            endedAt: new Date(),
            error: { message: 'Shadow‑Twin nicht gefunden' }
          })
          await repo.setStatus(jobId, 'failed', {
            error: { code: 'shadow_twin_not_found', message: 'Shadow‑Twin nicht gefunden' }
          })
        } catch (error) {
          FileLogger.error('start-route', 'Fehler beim Markieren des Jobs als failed', {
            jobId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }

      // Policies lesen
      const phasePolicies = readPhasesAndPolicies(job.parameters)
      
      // Library-Config für Template-Auswahl laden
      let libraryConfig: LibraryChatConfig | undefined = undefined
      try {
        const libraryService = LibraryService.getInstance()
        const email = userEmail || job.userEmail
        const libraryForConfig = await libraryService.getLibrary(email, job.libraryId)
        libraryConfig = libraryForConfig?.config?.chat
      } catch (error) {
        FileLogger.warn('start-route', 'Fehler beim Laden der Library-Config', {
          jobId,
          libraryId: job.libraryId,
          error: error instanceof Error ? error.message : String(error),
        })
        // Nicht kritisch - Template-Auswahl kann auch ohne Config funktionieren
      }

      // Target-Parent-ID bestimmen (Shadow-Twin-Folder oder Parent)
      // WICHTIG: Job-Objekt neu laden, um aktuelles Shadow-Twin-State zu erhalten
      // Das Shadow-Twin-State wurde beim Job-Start analysiert und gespeichert
      const updatedJob = await repo.get(jobId)
      const shadowTwinFolderId = updatedJob?.shadowTwinState?.shadowTwinFolderId || shadowTwinState?.shadowTwinFolderId
      const targetParentId = shadowTwinFolderId || job.correlation?.source?.parentId || 'root'

      // Template-Phase ausführen
      // WICHTIG: Aktualisiertes Job-Objekt verwenden, damit runTemplatePhase das aktuelle Shadow-Twin-State sieht
      const ctxPreUpdated: RequestContext = { request, jobId, job: updatedJob || job, body: {}, callbackToken: undefined, internalBypass: true }
      const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
      const extractedText = stripAllFrontmatter(shadowTwinData.markdown)
      const templateResult = await runTemplatePhase({
        ctx: ctxPreUpdated,
        provider,
        repo,
        extractedText,
        bodyMetadata: shadowTwinData.meta,
        policies: { metadata: phasePolicies.metadata as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
        autoSkip: true,
        imagesPhaseEnabled: false, // Template-Only: keine Bilder verarbeiten
        targetParentId,
        libraryConfig,
      })

      if (templateResult.status === 'failed') {
        const errorMessage = templateResult.errorMessage || 'Template-Phase fehlgeschlagen'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
      }

      // v2-only: Keine Legacy-Cleanup/Reparatur in Phase A.

      // Shadow-Twin-State aktualisieren: processingStatus auf 'ready' setzen
      // Template-Only: Nach erfolgreichem Template-Lauf ist der Shadow-Twin vollständig
      try {
        const updatedJob = await repo.get(jobId)
        if (updatedJob?.shadowTwinState) {
          const mongoState = toMongoShadowTwinState({
            ...updatedJob.shadowTwinState,
            processingStatus: 'ready' as const,
          })
          await repo.setShadowTwinState(jobId, mongoState)
        }
      } catch (error) {
        FileLogger.error('start-route', 'Fehler beim Aktualisieren des Shadow-Twin-States', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
      })
        // Fehler nicht kritisch - Job kann trotzdem abgeschlossen werden
      }

      // Job als completed markieren (Template-Only: keine weiteren Phasen)
      const { setJobCompleted } = await import('@/lib/external-jobs/complete')
      await setJobCompleted({
        ctx: ctxPreUpdated,
        // Template-Only: savedItemId aus der Template-Phase weiterreichen (Contract: completed ⇒ savedItemId).
        result: { savedItemId: templateResult.savedItemId },
      })

      return NextResponse.json({ ok: true, jobId, kind: 'template_only' })
    }

    // Secretary-Flow (Extract/Template)
    const secret = (await import('crypto')).randomBytes(24).toString('base64url')
    const secretHash = repo.hashSecret(secret)
    // WICHTIG:
    // Wir setzen Status+Hash idempotent, aber blockieren Start-Requests NICHT.
    // Duplicate-Handling erfolgt über Logging/Root-Cause-Fix (Worker/Client).
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

    // WICHTIG: Request nur senden, wenn Extract ausgeführt werden soll
    if (!runExtract) {
      FileLogger.info('start-route', 'Extract-Phase übersprungen - kein Request an Secretary Service', {
      jobId,
        extractGateExists,
        extractGateReason,
        extractDirective,
        shouldRunExtractPhase,
        runExtract
      })

      // Watchdog explizit stoppen, da kein externer Worker-Callback mehr erwartet wird.
      // Andernfalls würde der Watchdog den Job fälschlicherweise nach Timeout auf "failed" setzen.
      try {
        clearWatchdog(jobId)
      } catch {}
      
      // Markiere Extract-Step als skipped
      try {
        await repo.updateStep(jobId, extractStepName, {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // Wenn auch Template und Ingest übersprungen werden, Job als completed markieren
      if (!runTemplate && !runIngestOnly) {
        // Extract-Only-Modus: Extract wurde übersprungen (Gate), Template/Ingest deaktiviert
        // Trace-Event für Validator hinzufügen
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'extract',
            name: 'extract_only_mode',
            attributes: {
              message: 'Extract-Only Modus aktiviert (Extract übersprungen via Gate)',
              skipped: true,
              reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            },
          })
        } catch {
          // Trace-Fehler nicht kritisch
        }

        // Template- und Ingest-Phase sind über Phasen-Konfiguration deaktiviert.
        // Für eine konsistente Statuskommunikation müssen die Steps explizit als
        // "skipped" markiert werden. WICHTIG: Wenn Template bereits einen Reason hat
        // (z.B. legacy_markdown_adopted), diesen nicht überschreiben.
        try {
          const currentStep = job.steps?.find(s => s?.name === 'transform_template')
          const currentReason = currentStep?.details && typeof currentStep.details === 'object' && 'reason' in currentStep.details
            ? String(currentStep.details.reason)
            : undefined
          
          // Nur überschreiben, wenn noch kein Reason gesetzt wurde
          if (!currentReason || currentReason === 'pending') {
            await repo.updateStep(jobId, 'transform_template', {
              status: 'completed',
              endedAt: new Date(),
              details: {
                skipped: true,
                reason: templateSkipReason || 'phase_disabled',
              },
            })
          }
        } catch {}
        try {
          await repo.updateStep(jobId, 'ingest_rag', {
            status: 'completed',
            endedAt: new Date(),
            details: {
              skipped: true,
              reason: 'phase_disabled',
            },
          })
        } catch {}

        // Shadow-Twin-State auf "ready" setzen, falls bereits vorhanden.
        // Auch wenn keine neuen Artefakte erzeugt wurden, signalisiert dies,
        // dass der Job abgeschlossen ist und ein existierender Shadow-Twin
        // für die Anzeige verwendet werden kann.
        // WICHTIG: Verwende toMongoShadowTwinState für korrekte Konvertierung
        try {
          if (job.shadowTwinState) {
            const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
            const mongoState = toMongoShadowTwinState({
              ...job.shadowTwinState,
              processingStatus: 'ready' as const,
            })
            await repo.setShadowTwinState(jobId, mongoState)
        } else {
            // Falls kein Shadow-Twin-State existiert, aber ein Shadow-Twin-Verzeichnis vorhanden ist,
            // analysiere es und setze den Status auf "ready"
            if (job.correlation?.source?.itemId && library) {
              try {
                const { analyzeShadowTwinWithService } = await import('@/lib/shadow-twin/analyze-shadow-twin')
                const lang = (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage || 'de'
                const shadowTwinState = await analyzeShadowTwinWithService(job.correlation.source.itemId, provider, job.userEmail, library, lang)
                if (shadowTwinState) {
                  const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
                  const mongoState = toMongoShadowTwinState({
                    ...shadowTwinState,
                    processingStatus: 'ready' as const,
                  })
                  await repo.setShadowTwinState(jobId, mongoState)
                }
              } catch {
                // Fehler bei Shadow-Twin-Analyse nicht kritisch
              }
            }
          }
        } catch {
          // Fehler bei Status-Aktualisierung nicht kritisch
        }

        const completed = await setJobCompleted({ 
          ctx: { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }, 
          result: {} 
        })
        getJobEventBus().emitUpdate(job.userEmail, {
          type: 'job_update',
        jobId,
          status: 'completed',
          progress: 100,
          updatedAt: new Date().toISOString(),
          message: 'completed (all phases skipped)',
          jobType: job.job_type,
          fileName: job.correlation?.source?.name,
          sourceItemId: job.correlation?.source?.itemId,
          libraryId: job.libraryId
        })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'all_phases_skipped' })
      }
      
      // Wenn nur Extract übersprungen wird, aber Template/Ingest laufen sollen, return
      // (Template-only Flow wird oben bereits behandelt)
      return NextResponse.json({ ok: true, jobId, kind: 'extract_skipped' })
    }

    // Bereite Secretary-Service-Request vor
    const requestConfig = prepareSecretaryRequest(job, file, callbackUrl, secret)
    const { url, formData: formForRequest, headers } = requestConfig
    const submitAtIso = new Date().toISOString()
    const submitAtMs = Date.now()
    
    FileLogger.info('start-route', 'Sende Request an Secretary Service', {
      jobId,
      url,
      method: 'POST',
      hasApiKey: !!requestConfig.headers['Authorization']
    });

    // Trace + Timing: Request wird an Secretary gesendet
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'preprocess',
        name: 'secretary_request_sent',
        attributes: {
          url,
          method: 'POST',
          submitAt: submitAtIso,
          extractionMethod,
        },
      })
    } catch {}
    try {
      await repo.setSecretaryTiming(jobId, {
        submitAt: submitAtIso,
        requestUrl: url,
        requestMethod: 'POST',
      })
    } catch {}
    
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
    const ackAtIso = new Date().toISOString()
    const submitToAckMs = Math.max(0, Date.now() - submitAtMs)
    
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'preprocess',
        name: 'secretary_request_ack',
        attributes: {
          status: resp.status,
          statusText: resp.statusText,
          url,
          extractionMethod,
          ackAt: ackAtIso,
          submitToAckMs,
          // Duplicate-Diagnose:
          startRequestId: request.headers.get('x-start-request-id') || request.headers.get('x-request-id') || undefined,
          workerId: request.headers.get('x-worker-id') || undefined,
          workerTickId: request.headers.get('x-worker-tick-id') || undefined,
          pid: process.pid,
        },
      })
    } catch (error) {
      FileLogger.error('start-route', 'Fehler beim Hinzufügen des Trace-Events', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Trace-Fehler nicht kritisch - Job kann trotzdem fortgesetzt werden
    }
    try {
      await repo.setSecretaryTiming(jobId, {
        ackAt: ackAtIso,
        ackStatus: resp.status,
        ackStatusText: resp.statusText,
        submitToAckMs,
      })
    } catch {}

    // UX: Step sofort auf "running" setzen, sobald der Request zum Worker ack'ed wurde.
    // Ohne dieses Update bleibt der Step in der UI lange auf "pending", obwohl der Job bereits läuft
    // und nur auf den Callback wartet.
    try {
      await repo.updateStep(jobId, extractStepName, { status: 'running', startedAt: new Date() })
    } catch {}
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
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 0, updatedAt: new Date().toISOString(), message: 'enqueued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, libraryId: job.libraryId })
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
    try {
      // Versuche Job zu laden für Kontext
      const jobForError = await repo.get(jobId).catch(() => null)
      if (jobForError) {
        await handleJobError(err, {
        jobId,
          userEmail: jobForError.userEmail,
          jobType: jobForError.job_type,
          fileName: jobForError.correlation?.source?.name,
          sourceItemId: jobForError.correlation?.source?.itemId,
        }, repo, 'start_error')
      } else {
        // Fallback: Nur Status setzen ohne vollständigen Kontext
        await repo.setStatus(jobId, 'failed', { error: { code: 'start_error', message: errorMessage } })
      }
    } catch {
      // Fehler beim Error-Handling nicht weiter propagieren
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


