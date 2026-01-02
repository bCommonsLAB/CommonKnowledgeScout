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
import { adoptLegacyMarkdownToShadowTwin } from '@/lib/external-jobs/legacy-markdown-adoption'
import { cleanupLegacyMarkdownAfterTemplate } from '@/lib/external-jobs/legacy-markdown-cleanup'
import { checkJobStartability } from '@/lib/external-jobs/job-status-check'
import { prepareSecretaryRequest } from '@/lib/external-jobs/secretary-request'
import { tracePreprocessEvents } from '@/lib/external-jobs/trace-helpers'
import { handleJobError } from '@/lib/external-jobs/error-handler'
import { analyzeShadowTwin } from '@/lib/shadow-twin/analyze-shadow-twin'
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
    // Prüfe, ob Job gestartet werden kann
    const startability = checkJobStartability(job)
    if (!startability.canStart) {
      try { await repo.traceAddEvent(jobId, { spanId: 'job', name: 'start_already_started' }) } catch {}
      return NextResponse.json({ ok: true, status: 'already_started' }, { status: 202 })
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
    FileLogger.info('start-route', 'Starte Shadow-Twin-Analyse', {
      jobId,
      itemId: src.itemId,
      fileName: src.name
    })
    let shadowTwinState: Awaited<ReturnType<typeof analyzeShadowTwin>> | null = null
    try {
      shadowTwinState = await analyzeShadowTwin(src.itemId, provider);
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
        const parentId = src.parentId || 'root'
        const originalName = src.name || 'output'
        const folderName = generateShadowTwinFolderName(originalName)

        // OPTIMIERUNG: Wir haben eben `analyzeShadowTwin()` gemacht und wissen, dass kein Folder existiert.
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

    // Phasen-spezifische Preprozessoren aufrufen (bauen auf derselben Storage/Library-Logik auf)
    const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
    let preExtractResult: Awaited<ReturnType<typeof preprocessorPdfExtract>> | null = null
    let preTemplateResult: Awaited<ReturnType<typeof preprocessorTransformTemplate>> | null = null
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
          options: job.correlation?.options as { targetLanguage?: string } | undefined,
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
    // **WICHTIG**: Wenn Legacy-Datei im PDF-Ordner existiert und Frontmatter valide ist,
    // muss sie in den Shadow-Twin-Folder übernommen werden (TC-2.5 Reparatur-Szenario)
    let templateSkipReason: string | undefined = undefined
    if (templateEnabled && !runTemplate) {
      // Legacy-Datei-Übernahme: Wenn Frontmatter valide ist, Legacy-Datei in Shadow-Twin verschieben
      const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      const legacyAdopted = await adoptLegacyMarkdownToShadowTwin(ctxPre, preTemplateResult, provider, repo)
      
      // Step-Reason basierend auf Legacy-Adoption setzen
      templateSkipReason = legacyAdopted && preTemplateResult?.markdownFileId
        ? 'legacy_markdown_adopted'
        : 'preprocess_frontmatter_valid'
      
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
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_has_markdown' } }) } catch {}
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_frontmatter_valid' } }) } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}

      // **WICHTIG**: Wenn Legacy-Datei im PDF-Ordner existiert und Frontmatter valide ist,
      // muss sie in den Shadow-Twin-Folder übernommen werden (TC-2.5 Reparatur-Szenario)
      const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      await adoptLegacyMarkdownToShadowTwin(ctxPre, preTemplateResult, provider, repo)
      
      // Lade Job neu, um aktualisiertes shadowTwinState zu erhalten (kann sich durch adoptLegacyMarkdownToShadowTwin geändert haben)
      const updatedJob = await repo.get(jobId)
      if (updatedJob) {
        ctxPre.job = updatedJob
      }
      
      // Shadow-Twin-Markdown-Datei laden (verwendet jetzt shadowTwinState.transformed.id falls verfügbar)
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
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, libraryId: job.libraryId })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'ingest_only' })
      }

      return NextResponse.json({ ok: true, jobId, kind: 'ingest_only', skipped: ingestResult.skipped })
    }

    // Template-only: vorhandenes Markdown nutzen, Frontmatter reparieren lassen
    if (!runExtract && runTemplate) {
      // Markiere Extract-Step als skipped, wenn Extract übersprungen wurde (Gate oder Phase deaktiviert)
      // WICHTIG: Dies muss auch hier passieren, wenn Template ausgeführt wird
      try {
        await repo.updateStep(jobId, 'extract_pdf', {
          status: 'completed',
          endedAt: new Date(),
          details: {
            skipped: true,
            reason: extractGateExists ? 'shadow_twin_exists' : 'phase_disabled',
            gateReason: extractGateReason
          }
        })
      } catch {}
      
      // Optionaler Hinweis auf ein Legacy-Markdown im PDF-Ordner aus dem Preprocess
      // Dies wird insbesondere für Reparatur-Szenarien (z.B. TC-2.5) verwendet:
      // - Vor dem Lauf existiert eine transformierte Datei im PDF-Ordner
      // - Nach erfolgreichem Template-Lauf soll diese Datei entfernt werden,
      //   damit nur noch konsolidierte Artefakte im Shadow-Twin-Verzeichnis liegen.
      const legacyMarkdownId = preTemplateResult?.markdownFileId

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
        const library = await libraryService.getLibrary(email, job.libraryId)
        libraryConfig = library?.config?.chat
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

      // Reparatur-Logik: Legacy-Markdown im PDF-Ordner nach erfolgreichem Template-Lauf entfernen
      // Übergebe Original-Dateiname des PDFs für korrekte Shadow-Twin-Verzeichnis-Erkennung
      const sourceFileName = refreshedJob?.correlation?.source?.name || job.correlation?.source?.name
      await cleanupLegacyMarkdownAfterTemplate(jobId, legacyMarkdownId, preTemplateResult, provider, repo, sourceFileName)

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
        result: {},
      })

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
        await repo.updateStep(jobId, 'extract_pdf', {
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
                const { analyzeShadowTwin } = await import('@/lib/shadow-twin/analyze-shadow-twin')
                const shadowTwinState = await analyzeShadowTwin(job.correlation.source.itemId, provider)
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
    
    FileLogger.info('start-route', 'Sende Request an Secretary Service', {
      jobId,
      url,
      method: 'POST',
      hasApiKey: !!requestConfig.headers['Authorization']
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


