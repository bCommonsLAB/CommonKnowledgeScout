/**
 * @fileoverview External Jobs Callback API Route - Main Job Processing Endpoint
 * 
 * @description
 * Main callback endpoint for external job processing. Orchestrates the complete job execution
 * pipeline including authorization, template decision, transformation, chapter analysis,
 * markdown storage, image processing, and RAG ingestion. Handles progress updates and
 * error recovery. This is the central orchestration point for all external job processing.
 * 
 * @module external-jobs
 * 
 * @exports
 * - GET: Retrieves job status and details
 * - POST: Processes job callback from external service (Secretary Service)
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/external/jobs/[jobId]
 * - Secretary Service: Calls this endpoint with job results
 * - src/lib/external-jobs-worker.ts: Worker triggers job execution
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/external-jobs-repository: Job repository
 * - @/lib/external-jobs: All orchestration modules
 * - @/lib/storage/server-provider: Storage provider creation
 * - @/lib/services/library-service: Library service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
// import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
// import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
// import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
// Modularisierte Orchestrator-Module
import { readContext } from '@/lib/external-jobs/context'
import { authorizeCallback } from '@/lib/external-jobs/auth'
import { readPhasesAndPolicies } from '@/lib/external-jobs/policies'
import { handleProgressIfAny } from '@/lib/external-jobs/progress'
import { buildProvider } from '@/lib/external-jobs/provider'
import { runExtractOnly } from '@/lib/external-jobs/extract-only'
import { downloadMistralOcrRaw } from '@/lib/external-jobs/mistral-ocr-download'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { handleJobError, handleJobErrorWithDetails } from '@/lib/external-jobs/error-handler'
import { runTemplatePhase } from '@/lib/external-jobs/phase-template'
import { runIngestPhase } from '@/lib/external-jobs/phase-ingest'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
// parseSecretaryMarkdownStrict ungenutzt entfernt

// OneDrive-Utilities entfernt: Provider übernimmt Token/Uploads.

// entfernt: normalizeStructuredData, toAsciiKebab, splitToArray

// OneDrive-spezifische Upload-/Token-Utilities wurden entfernt; StorageFactory-Provider übernimmt das Speichern.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
      // UI-Fallback: ermöglicht Polling + Ableitung des Result-Items aus Shadow‑Twin, falls result.savedItemId fehlt.
      shadowTwinState: job.shadowTwinState,
      steps: job.steps,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Repo-Instanz erst bei Bedarf initialisieren (vorher ungenutzt)
    // Entfernt: lärmarme Callback-Header-Events – nur minimal notwendige Logs
    const workerId = request.headers.get('x-worker-id') || request.headers.get('X-Worker-Id') || undefined;
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    // Read validated context (params, headers, body, job)
    const ctx = await readContext({ request, jobId })
    const { job, body, internalBypass } = ctx
    const repo = new ExternalJobsRepository();

    // Helper: robustes Auslesen der Secretary-Timing-Felder aus `job.parameters`.
    // (Vermeidet fragile `?.['x']`-Ausdrücke und hält die Route kompilierbar.)
    const getSecretaryAckAt = (): string | undefined => {
      try {
        const params = (job as { parameters?: unknown }).parameters
        if (!params || typeof params !== 'object') return undefined
        const timings = (params as Record<string, unknown>)['timings']
        if (!timings || typeof timings !== 'object') return undefined
        const secretary = (timings as Record<string, unknown>)['secretary']
        if (!secretary || typeof secretary !== 'object') return undefined
        const ackAt = (secretary as Record<string, unknown>)['ackAt']
        return typeof ackAt === 'string' ? ackAt : undefined
      } catch {
        return undefined
      }
    }

    // entfernt

    // Prozess‑Guard (VOR Auth + VOR Status-Änderungen):
    // Wenn ein alter/anderer Worker-Prozess versehentlich Callbacks an dieselbe Route sendet,
    // ignorieren wir diese Events komplett. Sonst kann ein "falscher" Callback den Job-Status
    // kurzzeitig auf failed setzen und Tests/UI verwirren, obwohl der korrekte Prozess später
    // erfolgreich fertig wird.
    try {
      const incomingProcessId: string | undefined =
        (body?.process && typeof body.process.id === 'string')
          ? body.process.id
          : (typeof body?.data?.processId === 'string' ? body.data.processId : undefined)
      if (!internalBypass && job.processId && incomingProcessId && incomingProcessId !== job.processId) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'job',
            name: 'ignored_mismatched_process',
            level: 'warn',
            attributes: { incomingProcessId, jobProcessId: job.processId }
          })
        } catch {}
        return NextResponse.json({ status: 'ignored', reason: 'mismatched_process' });
      }
    } catch {}

    // Authorization and token guard
    await authorizeCallback(ctx)
    // entfernt

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    // entfernt: doppeltes callback_received-Event (wir loggen unten via appendLog ausreichend Details)
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);
    // Prozess‑Guard ist bewusst bereits VOR Auth/Status-Änderungen (siehe oben).

    // Secretary-Timing: Erster Callback nach ACK messen (idempotent).
    // Ziel: "Warum dauert der Start so lange?" sauber attribuieren (Queue/Warmup vs. App-Overhead).
    try {
      const firstCallbackAt = new Date().toISOString()
      const ackAt = getSecretaryAckAt()
      const ackToFirstCallbackMs = ackAt ? Math.max(0, Date.parse(firstCallbackAt) - Date.parse(ackAt)) : undefined

      const didSet = await repo.setSecretaryTimingIfMissing(
        jobId,
        {
          firstCallbackAt,
          ...(typeof ackToFirstCallbackMs === 'number' ? { ackToFirstCallbackMs } : {}),
        },
        'firstCallbackAt'
      )
      if (didSet) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'extract',
            name: 'secretary_first_callback',
            attributes: {
              firstCallbackAt,
              ...(typeof ackToFirstCallbackMs === 'number' ? { ackToFirstCallbackMs } : {}),
              phaseInBody: typeof body?.phase === 'string' ? body.phase : null,
            },
          })
        } catch {}
      }
    } catch {}

    // Progress-Handling (Short-Circuit)
    const short = await handleProgressIfAny(ctx, repo, workerId)
    // entfernt
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof (body?.data as { phase?: unknown })?.phase === 'string' && (body!.data as { phase: string }).phase) || undefined;
    const hasError = !!(body as { error?: unknown })?.error;
    // WICHTIG: Bei Mistral OCR wird pages_archive_url verwendet, nicht images_archive_url
    // Beide URLs sollten als finales Payload erkannt werden
    // NEU: Asynchroner Webhook sendet mistral_ocr_raw_url und mistral_ocr_raw_metadata (keine vollständigen Daten)
    // Die vollständigen Daten müssen über Download-Endpoint abgerufen werden: GET /api/pdf/jobs/{job_id}/mistral-ocr-raw
    const hasFinalPayload = !!(
      (body?.data as { extracted_text?: unknown })?.extracted_text || 
      (body?.data as { images_archive_url?: unknown })?.images_archive_url || 
      (body?.data as { pages_archive_url?: unknown })?.pages_archive_url ||
      (body?.data as { mistral_ocr_raw_url?: unknown })?.mistral_ocr_raw_url ||
      (body?.data as { mistral_ocr_raw_metadata?: unknown })?.mistral_ocr_raw_metadata ||
      (body?.data as { mistral_ocr_raw?: unknown })?.mistral_ocr_raw || // Rückwärtskompatibilität (Legacy)
      (body as { status?: unknown })?.status === 'completed' || 
      body?.phase === 'template_completed'
    );

    // Secretary-Timing: Finaler Payload empfangen (idempotent).
    try {
      if (hasFinalPayload) {
        const finalPayloadAt = new Date().toISOString()
        const ackAt = getSecretaryAckAt()
        const ackToFinalPayloadMs = ackAt ? Math.max(0, Date.parse(finalPayloadAt) - Date.parse(ackAt)) : undefined

        const didSet = await repo.setSecretaryTimingIfMissing(
          jobId,
          {
            finalPayloadAt,
            ...(typeof ackToFinalPayloadMs === 'number' ? { ackToFinalPayloadMs } : {}),
          },
          'finalPayloadAt'
        )
        if (didSet) {
          try {
            await repo.traceAddEvent(jobId, {
              spanId: 'extract',
              name: 'secretary_final_payload_received',
              attributes: {
                finalPayloadAt,
                ...(typeof ackToFinalPayloadMs === 'number' ? { ackToFinalPayloadMs } : {}),
              },
            })
          } catch {}
        }
      }
    } catch {}
    // Diagnose: Eingang loggen (erweitert für Debugging)
    try {
      const bodyDataKeys = body?.data && typeof body.data === 'object' ? Object.keys(body.data as Record<string, unknown>) : []
      const bodyDataSample: Record<string, unknown> = {}
      if (body?.data && typeof body.data === 'object') {
        const data = body.data as Record<string, unknown>
        // Logge wichtige Felder für Debugging
        bodyDataSample.hasExtractedText = !!data.extracted_text
        bodyDataSample.hasMistralOcrRaw = !!data.mistral_ocr_raw // Legacy: nur für Rückwärtskompatibilität
        bodyDataSample.hasMistralOcrRawUrl = !!data.mistral_ocr_raw_url // NEU: Asynchroner Webhook sendet nur URL (Indikator)
        bodyDataSample.hasMistralOcrRawMetadata = !!data.mistral_ocr_raw_metadata // NEU: Metadaten (model, pages_count, usage_info) ohne große Daten
        bodyDataSample.hasPagesArchiveUrl = !!data.pages_archive_url
        bodyDataSample.hasPagesArchiveData = !!data.pages_archive_data
        bodyDataSample.hasImagesArchiveUrl = !!data.images_archive_url
        bodyDataSample.hasImagesArchiveData = !!data.images_archive_data
        if (data.mistral_ocr_raw && typeof data.mistral_ocr_raw === 'object') {
          const raw = data.mistral_ocr_raw as Record<string, unknown>
          bodyDataSample.mistralOcrRawKeys = Object.keys(raw)
          if (Array.isArray(raw.pages)) {
            bodyDataSample.mistralOcrRawPagesCount = raw.pages.length
            // Prüfe ob Bilder vorhanden sind
            const pagesWithImages = raw.pages.filter((page: unknown) => {
              if (page && typeof page === 'object' && 'images' in page) {
                const p = page as { images?: unknown[] }
                return Array.isArray(p.images) && p.images.length > 0
              }
              return false
            })
            bodyDataSample.mistralOcrRawPagesWithImages = pagesWithImages.length
          }
        }
        // Logge pages_archive_url Wert (falls vorhanden)
        if (data.pages_archive_url) {
          bodyDataSample.pagesArchiveUrlValue = typeof data.pages_archive_url === 'string' ? data.pages_archive_url : 'not_string'
        }
      }
      await repo.appendLog(jobId, { phase: 'callback_received', details: {
        internalBypass,
        hasToken: !!ctx.callbackToken,
        phaseInBody: body?.phase || body?.data?.phase || null,
        hasFinalPayload,
        keys: typeof body === 'object' && body ? Object.keys(body as Record<string, unknown>) : [],
        dataKeys: bodyDataKeys,
        dataSample: bodyDataSample,
      } } as unknown as Record<string, unknown>);
      
      // Zusätzlich: Logge kompletten Body-Struktur in FileLogger für Debugging
      FileLogger.info('callback-route', 'Callback Body Debug', {
        jobId,
        phase: body?.phase,
        hasData: !!body?.data,
        dataKeys: bodyDataKeys,
        dataSample: bodyDataSample,
        // Logge auch den kompletten Body (aber ohne große Base64-Strings)
        bodyStructure: body && typeof body === 'object' ? {
          phase: body.phase,
          message: (body as { message?: unknown }).message,
          process: body.process,
          data: (() => {
            if (!body.data || typeof body.data !== 'object') return null
            const data = body.data as Record<string, unknown>
            return {
              hasExtractedText: !!data.extracted_text,
              extractedTextLength: typeof data.extracted_text === 'string' 
                ? data.extracted_text.length 
                : 0,
              hasMistralOcrRaw: !!data.mistral_ocr_raw, // Legacy: nur für Rückwärtskompatibilität
              hasMistralOcrRawUrl: !!data.mistral_ocr_raw_url, // NEU: Asynchroner Webhook sendet nur URL (Indikator)
              hasMistralOcrRawMetadata: !!data.mistral_ocr_raw_metadata, // NEU: Metadaten ohne große Daten
              hasPagesArchiveUrl: !!data.pages_archive_url,
              pagesArchiveUrl: data.pages_archive_url,
              hasPagesArchiveData: !!data.pages_archive_data,
              hasImagesArchiveUrl: !!data.images_archive_url,
              hasImagesArchiveData: !!data.images_archive_data,
              metadataKeys: data.metadata && typeof data.metadata === 'object'
                ? Object.keys(data.metadata as Record<string, unknown>)
                : [],
            }
          })(),
        } : null,
      });
    } catch {}

    // Terminal: "failed"-Phase immer sofort abbrechen
    if (!hasFinalPayload && !hasError && phase === 'failed') {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', message: phase });
      try {
        const extractStepName = job.job_type === 'audio' ? 'extract_audio' : job.job_type === 'video' ? 'extract_video' : 'extract_pdf'
        await repo.updateStep(jobId, extractStepName, { status: 'failed', endedAt: new Date(), error: { message: phase || 'Worker meldete failed' } })
      } catch {}
      // gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      await handleJobError(
        new Error(phase || 'Worker meldete failed'),
        {
          jobId,
          userEmail: job.userEmail,
          jobType: job.job_type,
          fileName: job.correlation?.source?.name,
          sourceItemId: job.correlation?.source?.itemId,
        },
        repo,
        'worker_failed_phase',
        'extract'
      );
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed_phase' });
    }

    if (short) return NextResponse.json(short.body, { status: short.status })

    // NEU: Error-Webhook-Verarbeitung (Secretary Service sendet jetzt Error-Webhooks)
    // Bei MongoDB-Fehlern wird ein Error-Webhook mit phase: "error" gesendet
    // Der Error-Webhook kann auch extracted_text, mistral_ocr_raw_url und mistral_ocr_raw_metadata enthalten
    // Hinweis: mistral_ocr_raw_url ist nur ein Indikator - Daten müssen über Download-Endpoint abgerufen werden
    if (phase === 'error' || hasError) {
      clearWatchdog(jobId);
      const errorData = (body as { error?: unknown })?.error || (body?.data as { error?: unknown })?.error
      const errorCode = errorData && typeof errorData === 'object' && 'code' in errorData 
        ? String((errorData as { code?: unknown }).code)
        : 'worker_error'
      const errorMessage = errorData && typeof errorData === 'object' && 'message' in errorData
        ? String((errorData as { message?: unknown }).message)
        : 'Externer Worker-Fehler'
      
      // Bei Error-Webhooks können auch extracted_text, mistral_ocr_raw_url und mistral_ocr_raw_metadata vorhanden sein
      // Diese sollten trotzdem verarbeitet werden, auch wenn der Job als failed markiert wird
      // Hinweis: mistral_ocr_raw_url ist nur ein Indikator - vollständige Daten müssen über Download-Endpoint abgerufen werden
      const errorExtractedText = (body?.data as { extracted_text?: unknown })?.extracted_text as string | undefined
      const errorMistralOcrRawUrl = (body?.data as { mistral_ocr_raw_url?: unknown })?.mistral_ocr_raw_url as string | undefined
      const errorMistralOcrRawMetadata = (body?.data as { mistral_ocr_raw_metadata?: unknown })?.mistral_ocr_raw_metadata
      
      bufferLog(jobId, { 
        phase: 'failed', 
        details: errorData,
        hasExtractedText: !!errorExtractedText,
        hasMistralOcrRawUrl: !!errorMistralOcrRawUrl,
        hasMistralOcrRawMetadata: !!errorMistralOcrRawMetadata
      });
      
      // Bei Fehler: gepufferte Logs persistieren
      // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
      void drainBufferedLogs(jobId);
      
      // Speichere auch extracted_text im Payload, falls vorhanden (für spätere Verarbeitung)
      if (errorExtractedText) {
        try {
          await repo.setResult(jobId, { extracted_text: errorExtractedText }, job.result || {})
        } catch {}
      }
      
      await handleJobErrorWithDetails(
        new Error(errorMessage),
        {
          jobId,
          userEmail: job.userEmail,
          jobType: job.job_type,
          fileName: job.correlation?.source?.name,
          sourceItemId: job.correlation?.source?.itemId,
        },
        repo,
        errorCode,
        {
          ...(errorData as Record<string, unknown> || {}),
          ...(errorMistralOcrRawUrl ? { mistral_ocr_raw_url: errorMistralOcrRawUrl } : {}),
          ...(errorMistralOcrRawMetadata ? { mistral_ocr_raw_metadata: errorMistralOcrRawMetadata } : {}),
        },
        'extract'
      );
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    function getExtractStepName(jobType: string): 'extract_pdf' | 'extract_audio' | 'extract_video' {
      if (jobType === 'audio') return 'extract_audio'
      if (jobType === 'video') return 'extract_video'
      return 'extract_pdf'
    }

    // Finale Payload
    const extractedTextRaw: string | undefined = (body?.data as { extracted_text?: unknown })?.extracted_text as string | undefined;
    const transcriptionTextRaw: string | undefined =
      (body?.data as { transcription?: { text?: unknown } })?.transcription?.text as string | undefined

    // Compatibility (audio/video): accept a few common payload shapes.
    // Primary expected shape is: data.transcription.text
    const audioTextCompat: string | undefined = (() => {
      if (!(job.job_type === 'audio' || job.job_type === 'video')) return undefined
      const data = body?.data as Record<string, unknown> | undefined
      const directText = data && typeof data['text'] === 'string' ? String(data['text']) : undefined
      const transcriptionText =
        typeof transcriptionTextRaw === 'string' ? transcriptionTextRaw : undefined
      const extractedTextFallback =
        typeof extractedTextRaw === 'string' ? extractedTextRaw : undefined
      return transcriptionText || directText || extractedTextFallback
    })()

    const extractedText: string | undefined = (() => {
      if (job.job_type === 'audio' || job.job_type === 'video') return audioTextCompat
      return typeof extractedTextRaw === 'string' ? extractedTextRaw : undefined
    })()
    const imagesArchiveUrlFromWorker: string | undefined = (body?.data as { images_archive_url?: unknown })?.images_archive_url as string | undefined;
    
    // Mistral OCR: pages_archive_data kann direkt als Base64 vorhanden sein (Legacy)
    const pagesArchiveData: string | undefined = (body?.data as { pages_archive_data?: unknown })?.pages_archive_data as string | undefined;
    // Mistral OCR: pages_archive_url ist die neue Variante (ZIP-Download von URL)
    const pagesArchiveUrl: string | undefined = (body?.data as { pages_archive_url?: unknown })?.pages_archive_url as string | undefined;
    const imagesArchiveData: string | undefined = (body?.data as { images_archive_data?: unknown })?.images_archive_data as string | undefined;
    
    // Mistral OCR: Asynchroner Webhook sendet nur mistral_ocr_raw_url und mistral_ocr_raw_metadata
    // Die vollständigen mistral_ocr_raw Daten müssen über den Download-Endpoint abgerufen werden
    const mistralOcrRawUrl: string | undefined = (body?.data as { mistral_ocr_raw_url?: unknown })?.mistral_ocr_raw_url as string | undefined
    const mistralOcrRawMetadata: unknown = (body?.data as { mistral_ocr_raw_metadata?: unknown })?.mistral_ocr_raw_metadata
    let mistralOcrRaw: unknown = (body?.data as { mistral_ocr_raw?: unknown })?.mistral_ocr_raw // Legacy: nur für Rückwärtskompatibilität
    
    // Mistral OCR: mistral_ocr_images_url enthält eingebettete Bilder als ZIP-Archiv
    // WICHTIG: Bilder sind NIEMALS in mistral_ocr_raw eingebettet, sondern werden separat bereitgestellt
    const mistralOcrImagesUrl: string | undefined = (body?.data as { mistral_ocr_images_url?: unknown })?.mistral_ocr_images_url as string | undefined
    
    // Wenn mistral_ocr_raw_url oder mistral_ocr_raw_metadata vorhanden ist, lade die Daten über den Download-Endpoint
    if ((mistralOcrRawUrl || mistralOcrRawMetadata) && !mistralOcrRaw) {
      const downloadedRaw = await downloadMistralOcrRaw(body, jobId)
      if (downloadedRaw) {
        mistralOcrRaw = downloadedRaw
      }
    }
    
    // Debug: Logge kompletten Body-Struktur für Troubleshooting
    FileLogger.info('callback-route', 'Callback Body Structure', {
      jobId,
      phase: body?.phase,
      hasData: !!body?.data,
      dataKeys: body?.data && typeof body.data === 'object' ? Object.keys(body.data as Record<string, unknown>) : [],
      hasExtractedText: !!extractedText,
      hasPagesArchiveUrl: !!pagesArchiveUrl,
      hasPagesArchiveData: !!pagesArchiveData,
      hasMistralOcrRaw: !!mistralOcrRaw,
      hasMistralOcrRawUrl: !!mistralOcrRawUrl,
      hasMistralOcrRawMetadata: !!mistralOcrRawMetadata,
      hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
      mistralOcrRawType: typeof mistralOcrRaw,
      pagesArchiveUrlValue: pagesArchiveUrl,
    });
    const hasMistralOcrImages = mistralOcrRaw && typeof mistralOcrRaw === 'object' && 'pages' in mistralOcrRaw
      ? Array.isArray((mistralOcrRaw as { pages?: unknown }).pages) && (mistralOcrRaw as { pages: Array<{ images?: Array<{ image_base64?: string | null }> }> }).pages.some(
          (page) => page.images && page.images.length > 0 && page.images.some(img => img.image_base64 && img.image_base64 !== null)
        )
      : false;
    
    // Debug-Logging für Bilder-Verfügbarkeit
    bufferLog(jobId, { 
      phase: 'images_check', 
      message: 'Bilder-Verfügbarkeit prüfen',
      hasPagesArchiveData: !!pagesArchiveData,
      hasPagesArchiveUrl: !!pagesArchiveUrl,
      hasImagesArchiveData: !!imagesArchiveData,
      hasImagesArchiveUrl: !!imagesArchiveUrlFromWorker,
      hasMistralOcrImages,
      hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
      pagesArchiveDataLength: pagesArchiveData?.length || 0,
      imagesArchiveDataLength: imagesArchiveData?.length || 0,
      bodyPhase: body?.phase,
      bodyDataKeys: body?.data && typeof body.data === 'object' ? Object.keys(body.data as Record<string, unknown>) : [],
      mistralOcrRawType: typeof mistralOcrRaw,
      mistralOcrRawKeys: mistralOcrRaw && typeof mistralOcrRaw === 'object' ? Object.keys(mistralOcrRaw as Record<string, unknown>) : [],
    });

    // If the worker claims "completed" for audio/video but sends no transcription text,
    // we must fail fast (otherwise the job hangs in pending forever).
    if ((job.job_type === 'audio' || job.job_type === 'video') && body?.phase === 'completed' && !extractedText) {
      clearWatchdog(jobId)
      try {
        await repo.updateStep(jobId, getExtractStepName(job.job_type), {
          status: 'failed',
          endedAt: new Date(),
          error: { message: 'Worker completed but did not provide transcription text' },
        })
      } catch {}
      await repo.setStatus(jobId, 'failed', {
        error: { code: 'worker_payload_missing_transcription', message: 'Worker completed but did not provide transcription text' },
      })
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed_missing_transcription' })
    }

    // Prüfe auch auf pages_archive_data, pages_archive_url, mistral_ocr_images_url und mistral_ocr_raw für Mistral OCR
    // WICHTIG: mistral_ocr_images_url ist ein separater Endpoint für eingebettete Bilder (nicht in mistral_ocr_raw)
    if (!extractedText && !imagesArchiveUrlFromWorker && !pagesArchiveData && !pagesArchiveUrl && !imagesArchiveData && !mistralOcrImagesUrl && !hasMistralOcrImages && body?.phase !== 'template_completed') {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Phasen-Flags aus Parametern lesen (zur harten Deaktivierung von Teilphasen)
    const phasesParam = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { template?: boolean; ingest?: boolean } }).phases : undefined;
    const templatePhaseEnabled = phasesParam?.template !== false;
    const ingestPhaseEnabled = phasesParam?.ingest !== false;
    const imagesPhaseEnabled = (job.parameters && typeof job.parameters === 'object' && (job.parameters as { phases?: { images?: boolean } }).phases) ? ((job.parameters as { phases?: { images?: boolean } }).phases!.images !== false) : true
    
    bufferLog(jobId, { 
      phase: 'phases_check', 
      message: 'Phasen-Status prüfen',
      templatePhaseEnabled,
      ingestPhaseEnabled,
      imagesPhaseEnabled,
      hasExtractedText: !!extractedText,
      hasPagesArchiveData: !!pagesArchiveData,
      hasPagesArchiveUrl: !!pagesArchiveUrl,
      hasMistralOcrImages,
        hasMistralOcrImagesUrl: !!mistralOcrImagesUrl,
      hasImagesArchiveUrl: !!imagesArchiveUrlFromWorker
    });

    // Kurzschluss: Extract‑Only (Template und Ingest deaktiviert)
    if (!templatePhaseEnabled && !ingestPhaseEnabled) {
      const result = await runExtractOnly(
        ctx,
        repo,
        extractedText,
        pagesArchiveData,
        pagesArchiveUrl,
        imagesArchiveData,
        imagesArchiveUrlFromWorker,
        mistralOcrRaw,
        hasMistralOcrImages,
        mistralOcrImagesUrl,
        imagesPhaseEnabled
      )
      return NextResponse.json({ status: 'ok', jobId, kind: 'extract_only', savedItemId: result.savedItemId })
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'callback_before_library' }) } catch {}

    let savedItemId: string | undefined;
    const savedItems: string[] = [];
    let docMetaForIngestion: Record<string, unknown> | undefined;

    const extractStepName = getExtractStepName(job.job_type)

    if (lib) {
      const policies = readPhasesAndPolicies(ctx);
      const autoSkip = true;

        // Einheitliche Serverinitialisierung des Providers (DB-Config, Token enthalten)
        // Provider wird einmal erstellt und an alle Module weitergegeben
        const provider = await buildProvider({ userEmail: job.userEmail, libraryId: job.libraryId, jobId, repo })

        // DETERMINISTISCHE ARCHITEKTUR: Verwende Shadow-Twin-Verzeichnis aus Job-State
        // Der Kontext wurde beim Job-Start bestimmt und im Job-State gespeichert
        // Jeder Job hat seinen eigenen isolierten Kontext - keine gegenseitige Beeinflussung
        // IMPORTANT:
        // `targetParentId` must be able to switch to a newly created dot-folder during this callback.
        // Otherwise: transcript can be written into a new dot-folder, but template output is still written
        // into the original parent folder (and in some cases transcript can be overwritten by accident).
        let shadowTwinFolderId = job.shadowTwinState?.shadowTwinFolderId
        let targetParentId = shadowTwinFolderId || job.correlation?.source?.parentId || 'root';

        // WICHTIG: Wenn Extract-Phase aktiviert ist und extractedText vorhanden ist,
        // speichere das Transcript-Markdown SOFORT, bevor die Template-Phase ausgeführt wird.
        // Dies stellt sicher, dass Schritt 1 sein Ergebnis speichert, bevor Schritt 2 beginnt.
        // Die Schritte sollten unabhängig voneinander ihre Ergebnisse speichern.
        if (extractedText) {
          try {
            const { saveMarkdown } = await import('@/lib/external-jobs/storage')
            const { stripAllFrontmatter } = await import('@/lib/markdown/frontmatter')
            const { buildArtifactName } = await import('@/lib/shadow-twin/artifact-naming')
            const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
            const sourceItemId = job.correlation.source?.itemId || 'unknown'
            const sourceName = job.correlation.source?.name || 'output'
            
            // Erstelle ArtifactKey für Transcript
            const artifactKey = {
              sourceId: sourceItemId,
              kind: 'transcript' as const,
              targetLanguage: lang,
            }
            
            // Generiere Dateinamen mit zentraler Logik
            const transcriptFileName = buildArtifactName(artifactKey, sourceName)
            
            // Speichere Markdown OHNE Frontmatter (reines Transcript)
            // Frontmatter wird erst bei Template-Phase hinzugefügt
            const cleanText = stripAllFrontmatter(extractedText)
            
            // Sammle ZIP-Daten für direkten Upload (wenn persistToFilesystem=false)
            // WICHTIG: Bilder müssen hier gesammelt werden, damit sie mit dem Transcript in MongoDB gespeichert werden
            const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
            const shadowTwinConfig = getShadowTwinConfig(library)
            const persistToFilesystem = shadowTwinConfig.persistToFilesystem ?? true
            
            const zipArchives: Array<{ base64Data: string; fileName: string }> = []
            if (!persistToFilesystem && imagesPhaseEnabled) {
              // Hilfsfunktion: Lade ZIP von URL herunter und konvertiere zu Base64
              const downloadZipAsBase64 = async (url: string): Promise<string | undefined> => {
                try {
                  const { getSecretaryConfig } = await import('@/lib/env')
                  const { baseUrl: baseRaw } = getSecretaryConfig()
                  const isAbsolute = /^https?:\/\//i.test(url)
                  let archiveUrl = url
                  if (!isAbsolute) {
                    const base = baseRaw.replace(/\/$/, '')
                    const rel = url.startsWith('/') ? url : `/${url}`
                    archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') 
                      ? `${base}${rel.substring(4)}` 
                      : `${base}${rel}`
                  }
                  
                  const headers: Record<string, string> = {}
                  const { apiKey } = getSecretaryConfig()
                  if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`
                    headers['X-Secretary-Api-Key'] = apiKey
                  }
                  
                  const response = await fetch(archiveUrl, { method: 'GET', headers })
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                  }
                  const arrayBuffer = await response.arrayBuffer()
                  const buffer = Buffer.from(arrayBuffer)
                  return buffer.toString('base64')
                } catch (error) {
                  FileLogger.warn('callback-route', 'Fehler beim Herunterladen von ZIP-URL', {
                    url,
                    error: error instanceof Error ? error.message : String(error),
                  })
                  return undefined
                }
              }
              
              // Sammle ZIP-Daten von URLs herunter
              if (pagesArchiveUrl && !pagesArchiveData) {
                const base64Data = await downloadZipAsBase64(pagesArchiveUrl)
                if (base64Data) {
                  zipArchives.push({
                    base64Data,
                    fileName: (body?.data as { pages_archive_filename?: string })?.pages_archive_filename || 'pages.zip',
                  })
                }
              }
              
              if (imagesArchiveUrlFromWorker && !imagesArchiveData) {
                const base64Data = await downloadZipAsBase64(imagesArchiveUrlFromWorker)
                if (base64Data) {
                  zipArchives.push({
                    base64Data,
                    fileName: (body?.data as { images_archive_filename?: string })?.images_archive_filename || 'images.zip',
                  })
                }
              }
              
              if (mistralOcrImagesUrl) {
                const base64Data = await downloadZipAsBase64(mistralOcrImagesUrl)
                if (base64Data) {
                  zipArchives.push({
                    base64Data,
                    fileName: 'mistral_ocr_images.zip',
                  })
                }
              }
            }
            
            // Nutze saveMarkdown() für MongoDB-Unterstützung
            const savedResult = await saveMarkdown({
              ctx,
              parentId: targetParentId,
              fileName: transcriptFileName,
              markdown: cleanText,
              artifactKey,
              zipArchives: zipArchives.length > 0 ? zipArchives : undefined,
              jobId,
            })

            // If the transcript write created/used a dot-folder, use it for all subsequent phases in this callback.
            // This ensures transformations are stored next to the transcript (Shadow‑Twin truth).
            // WICHTIG: Bei MongoDB-only wird kein shadowTwinFolderId erstellt, daher prüfen wir den Job-State
            if (!shadowTwinFolderId) {
              const updatedJob = await repo.get(jobId)
              const updatedShadowTwinFolderId = updatedJob?.shadowTwinState?.shadowTwinFolderId
              if (updatedShadowTwinFolderId) {
                shadowTwinFolderId = updatedShadowTwinFolderId
                targetParentId = shadowTwinFolderId
              }
            }

            // Trace: Transcript-Speicherung explizit als Event persistieren
            try {
              const parentPath = await provider.getPathById(targetParentId).catch(() => null)
              await repo.traceAddEvent(jobId, {
                spanId: 'extract',
                name: 'extract_transcript_saved',
                attributes: {
                  artifactKind: artifactKey.kind,
                  targetLanguage: artifactKey.targetLanguage,
                  templateName: (artifactKey as { templateName?: string }).templateName || null,
                  parentId: targetParentId,
                  shadowTwinFolderId: shadowTwinFolderId || null,
                  fileId: savedResult.savedItemId,
                  fileName: transcriptFileName,
                  contentLength: cleanText.length,
                  path: parentPath ? `${parentPath}/${transcriptFileName}` : null,
                  zipArchivesCount: zipArchives.length,
                },
              })
            } catch {
              // Trace ist best-effort
            }
            
            bufferLog(jobId, {
              phase: 'extract_transcript_saved',
              message: `Transcript-Markdown gespeichert${shadowTwinFolderId ? ' im Shadow-Twin-Verzeichnis' : ' direkt im Parent'}`,
              parentId: targetParentId,
              shadowTwinFolderId: shadowTwinFolderId || null,
              savedItemId: savedResult.savedItemId,
              fileName: transcriptFileName,
            })
            
            // WICHTIG: Shadow-Twin-State nach dem Speichern aktualisieren
            // Dies stellt sicher, dass das Shadow-Twin-State im Job-Dokument aktualisiert wird
            if (savedResult.savedItemId && job.correlation?.source?.itemId) {
              try {
                const { analyzeShadowTwinWithService } = await import('@/lib/shadow-twin/analyze-shadow-twin')
                const { toMongoShadowTwinState } = await import('@/lib/shadow-twin/shared')
                const { LibraryService } = await import('@/lib/services/library-service')
                const library = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
                const lang = (job.correlation?.options as { targetLanguage?: string } | undefined)?.targetLanguage || 'de'
                const updatedShadowTwinState = await analyzeShadowTwinWithService(job.correlation.source.itemId, provider, job.userEmail, library, lang)
                if (updatedShadowTwinState) {
                  const mongoState = toMongoShadowTwinState({
                    ...updatedShadowTwinState,
                    processingStatus: 'processing' as const, // Noch nicht ready, Template-Phase folgt noch
                  })
                  await repo.setShadowTwinState(jobId, mongoState)
                  bufferLog(jobId, {
                    phase: 'extract_shadow_twin_state_updated',
                    message: 'Shadow-Twin-State nach Transcript-Speicherung aktualisiert',
                    shadowTwinFolderId: updatedShadowTwinState.shadowTwinFolderId || null,
                  })

                  // Keep the callback-local targetParentId in sync with the analyzed state.
                  if (updatedShadowTwinState.shadowTwinFolderId) {
                    shadowTwinFolderId = updatedShadowTwinState.shadowTwinFolderId
                    targetParentId = updatedShadowTwinState.shadowTwinFolderId
                  }
                }
              } catch (error) {
                bufferLog(jobId, {
                  phase: 'extract_shadow_twin_state_update_error',
                  message: `Fehler beim Aktualisieren des Shadow-Twin-States: ${error instanceof Error ? error.message : String(error)}`
                })
                // Fehler nicht kritisch - Template-Phase kann trotzdem fortgesetzt werden
              }
            }
          } catch (error) {
            bufferLog(jobId, {
              phase: 'extract_transcript_save_failed',
              message: `Fehler beim Speichern des Transcript-Markdowns: ${error instanceof Error ? error.message : String(error)}`
            })
            // Fehler nicht kritisch - Template-Phase kann trotzdem fortgesetzt werden
          }
        }

        // WICHTIG: Bilder-Verarbeitung hängt von persistToFilesystem ab:
        // - persistToFilesystem=true: Bilder werden in Phase 1 verarbeitet (Filesystem)
        // - persistToFilesystem=false: Bilder werden beim Transcript-Speichern verarbeitet (direkt nach Azure/MongoDB)
        // Für Audio/Video: Images-Phase ist irrelevant und wird als disabled behandelt.
        const imagesPhaseEnabledEffective = (job.job_type === 'pdf') ? imagesPhaseEnabled : false
        
        // Prüfe Shadow-Twin-Konfiguration für Bilder-Verarbeitung
        const libraryForImages = await LibraryService.getInstance().getLibrary(job.userEmail, job.libraryId)
        const shadowTwinConfigForImages = getShadowTwinConfig(libraryForImages)
        const persistToFilesystemForImages = shadowTwinConfigForImages.persistToFilesystem ?? true
        
        // Bilder nur in Phase 1 verarbeiten, wenn persistToFilesystem=true
        // Wenn persistToFilesystem=false, werden Bilder beim Transcript-Speichern verarbeitet (via zipArchives)
        if (extractedText && imagesPhaseEnabledEffective && persistToFilesystemForImages) {
          try {
            const { processAllImageSources } = await import('@/lib/external-jobs/images')
            const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
            
            await processAllImageSources(ctx, provider, {
              pagesArchiveData,
              pagesArchiveUrl,
              pagesArchiveFilename: (body?.data as { pages_archive_filename?: string })?.pages_archive_filename,
              imagesArchiveData,
              imagesArchiveFilename: (body?.data as { images_archive_filename?: string })?.images_archive_filename,
              imagesArchiveUrl: imagesArchiveUrlFromWorker,
              mistralOcrRaw,
              hasMistralOcrImages,
              mistralOcrImagesUrl,
              extractedText,
              lang,
              targetParentId,
              imagesPhaseEnabled: imagesPhaseEnabledEffective,
              shadowTwinFolderId, // Verwende Shadow-Twin-Verzeichnis aus Job-State
            })
            
            bufferLog(jobId, {
              phase: 'extract_images_processed',
              message: 'Bilder-Verarbeitung in Phase 1 (Extract) abgeschlossen (Filesystem)'
            })
          } catch (error) {
            bufferLog(jobId, {
              phase: 'extract_images_error',
              message: `Fehler bei der Bild-Verarbeitung in Phase 1: ${error instanceof Error ? error.message : String(error)}`
            })
            // Fehler nicht kritisch - Template-Phase kann trotzdem fortgesetzt werden
          }
        } else if (extractedText && imagesPhaseEnabledEffective && !persistToFilesystemForImages) {
          bufferLog(jobId, {
            phase: 'extract_images_skipped',
            message: 'Bilder-Verarbeitung in Phase 1 übersprungen (persistToFilesystem=false) - Bilder werden beim Transcript-Speichern direkt nach Azure/MongoDB hochgeladen'
          })
        }

        // Schrittstatus extract_* erst nach lokaler Persistenz setzen.
        // Motivation: Speichern (MongoDB/Blob/Filesystem) ist Teil unserer Extract-Pipeline und soll
        // zeitlich dem Extract-Span zugerechnet werden (statt als eigener "postprocessing"-Block aufzutauchen).
        if (extractedText) {
          try {
            const latest = await repo.get(jobId)
            const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === extractStepName) : undefined
            const alreadyCompleted = !!st && st.status === 'completed'
            if (!alreadyCompleted) await repo.updateStep(jobId, extractStepName, { status: 'completed', endedAt: new Date() })
          } catch {}
        }

        // Optionale Template-Verarbeitung (Phase 2) - vereinfacht via runTemplatePhase
        const fmFromBodyUnknown = (body?.data?.metadata as unknown) || null
        const fmFromBody = (fmFromBodyUnknown && typeof fmFromBodyUnknown === 'object' && !Array.isArray(fmFromBodyUnknown)) ? (fmFromBodyUnknown as Record<string, unknown>) : null

        // WICHTIG: ZIP-Daten gehören zur Phase 1 (Extract) und wurden bereits dort hochgeladen.
        // ZIP-Daten können jedoch für Template-Information benötigt werden (z.B. Seiten-Metadaten).
        // Daher werden ZIP-Daten an Phase 2 übergeben, aber imagesPhaseEnabled=false gesetzt,
        // damit keine Bilder mehr hochgeladen werden (Bilder wurden bereits in Phase 1 hochgeladen).
        // Phase 2 speichert nur das transformierte Markdown (ohne Bilder hochzuladen).
        // Falls Phase 2 eigene Assets erzeugt, werden diese am Ende von Phase 2 gespeichert.
        // Das Shadow-Twin reichert sich von Phase zu Phase an.
        
        // Cover-Bild-Generierung aus Job-Parametern lesen
        const jobParams = (job.parameters && typeof job.parameters === 'object') ? job.parameters as { 
          generateCoverImage?: boolean
          coverImagePrompt?: string 
        } : {}
        
        const templateResult = await runTemplatePhase({
          ctx,
          provider,
          repo,
          extractedText: extractedText || '',
          bodyMetadata: fmFromBody || undefined,
          policies: { metadata: policies.metadata as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
          autoSkip,
          imagesPhaseEnabled: false, // Keine Bilder hochladen - wurden bereits in Phase 1 hochgeladen
          // ZIP-Daten können für Template-Info benötigt werden, aber nicht für Bild-Upload
          pagesArchiveData: pagesArchiveData, // Für Template-Info verfügbar
          pagesArchiveUrl: pagesArchiveUrl, // Für Template-Info verfügbar
          pagesArchiveFilename: (body?.data as { pages_archive_filename?: string })?.pages_archive_filename,
          imagesArchiveData: imagesArchiveData, // Für Template-Info verfügbar
          imagesArchiveFilename: (body?.data as { images_archive_filename?: string })?.images_archive_filename,
          imagesArchiveUrl: imagesArchiveUrlFromWorker, // Für Template-Info verfügbar
          mistralOcrRaw: mistralOcrRaw, // Für Template-Info verfügbar
          hasMistralOcrImages: hasMistralOcrImages,
          mistralOcrImagesUrl: mistralOcrImagesUrl, // Für Template-Info verfügbar
          targetParentId,
          // Library-Chat-Config für Cover-Bild-Prompt-Fallback
          libraryConfig: lib.config?.chat,
          generateCoverImage: jobParams.generateCoverImage,
          coverImagePrompt: jobParams.coverImagePrompt,
        })

        // Fatal: Wenn Template-Transformation fehlgeschlagen ist, abbrechen
        if (templateResult.status === 'failed') {
            clearWatchdog(jobId)
          const errorMessage = templateResult.errorMessage || 'Template-Transformation fehlgeschlagen'
          bufferLog(jobId, { phase: 'failed', message: `${errorMessage} (fatal)` })
            void drainBufferedLogs(jobId)
          await handleJobError(
            new Error(errorMessage),
            {
              jobId,
              userEmail: job.userEmail,
              jobType: job.job_type,
              fileName: job.correlation?.source?.name,
              sourceItemId: job.correlation?.source?.itemId,
            },
            repo,
            'template_failed',
            'template'
          )
          return NextResponse.json({ status: 'ok', jobId, kind: 'failed_template' })
        }

        // Metadaten für Ingestion setzen
        docMetaForIngestion = templateResult.metadata
        savedItemId = templateResult.savedItemId

        // WICHTIG (Global Contract / HITL):
        // In seltenen Duplicate-Callback/Retry-Fällen kann `templateResult.savedItemId` leer sein,
        // obwohl die Transformationsdatei bereits gespeichert wurde (siehe Trace: artifact_saved).
        // Dann leiten wir die Datei deterministisch über den Artifact-Resolver aus dem Shadow‑Twin ab.
        if (!savedItemId) {
          try {
            const { resolveArtifact } = await import('@/lib/shadow-twin/artifact-resolver')
            const sourceItemId = job.correlation?.source?.itemId || ''
            const sourceName = job.correlation?.source?.name || ''
            const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
            const templateName = typeof (job.parameters as { template?: unknown } | undefined)?.template === 'string'
              ? String((job.parameters as { template: string }).template).trim()
              : ''

            if (sourceItemId && sourceName && templateName) {
              const resolved = await resolveArtifact(provider, {
                sourceItemId,
                sourceName,
                parentId: targetParentId,
                targetLanguage: lang,
                templateName,
                preferredKind: 'transformation',
              })
              if (resolved?.fileId) {
                savedItemId = resolved.fileId
                bufferLog(jobId, {
                  phase: 'template_saved_item_id_fallback',
                  message: 'savedItemId via resolveArtifact abgeleitet (Template-Job)',
                  savedItemId,
                  fileName: resolved.fileName,
                })
              }
            }
          } catch {
            // ignore – wenn auch das nicht klappt, greift später der Validator/Client-Fallback.
          }
        }

      // WICHTIG: Bilder-Verarbeitung wurde bereits in Phase 1 (Extract) durchgeführt
      // Die Template-Phase speichert nur das transformierte Markdown
      if (templateResult.savedItemId) {
        savedItems.push(templateResult.savedItemId)
      }

      // Schritt: ingest_rag (optional automatisiert) - vereinfacht via runIngestPhase
      try {
        const phasesParam = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { ingest?: boolean } }).phases : undefined
        const hardDisableIngest = phasesParam?.ingest === false
        // Ingestion kann auch ohne savedItemId ausgeführt werden, wenn docMetaForIngestion vorhanden ist
        // (runIngestPhase lädt dann das Markdown aus dem Shadow-Twin)
        if (!hardDisableIngest && docMetaForIngestion) {
          // Step starten
          await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() })
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}
          try { getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 10, updatedAt: new Date().toISOString(), message: 'ingest_start', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId, libraryId: job.libraryId }) } catch {}

          // Ingest-Phase ausführen
          // WICHTIG: Übergebe leeres markdown, damit loadShadowTwinMarkdown() das transformierte Markdown lädt
          // (nicht das rohe extractedText/Transcript)
          // Die Bilder werden über shadowTwinFolderId aufgelöst
          const ingestResult = await runIngestPhase({
            ctx,
            provider,
            repo,
            markdown: '', // Leer lassen, damit loadShadowTwinMarkdown() das transformierte Markdown lädt
            meta: docMetaForIngestion,
            savedItemId: savedItemId || '',
            policies: { ingest: policies.ingest as 'force' | 'skip' | 'auto' | 'ignore' | 'do' },
            extractedText: undefined, // Nicht übergeben, damit loadShadowTwinMarkdown() verwendet wird
          })

          if (ingestResult.error) {
            return NextResponse.json({ status: 'error', jobId, kind: 'failed_ingestion', reason: ingestResult.error }, { status: 500 })
          }
        } else if (hardDisableIngest) {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'phase_disabled' } })
        } else if (!docMetaForIngestion) {
          // BUG-FIX: Wenn docMetaForIngestion fehlt, muss der Step als skipped markiert werden.
          // Vorher blieb der Step auf "pending", was den Global Contract verletzte.
          FileLogger.warn('external-jobs', 'Ingest-Phase übersprungen: docMetaForIngestion fehlt', { jobId })
          await repo.updateStep(jobId, 'ingest_rag', { 
            status: 'completed', 
            endedAt: new Date(), 
            details: { 
              skipped: true, 
              reason: 'no_metadata_for_ingestion',
              message: 'Template-Phase hat keine Metadaten für Ingestion geliefert'
            } 
          })
        }
      } catch (err) {
        const reason = (() => {
          if (err && typeof err === 'object') {
            const e = err as { message?: unknown }
            const msg = typeof e.message === 'string' ? e.message : undefined
            return msg || String(err)
          }
          return String(err)
        })()
        bufferLog(jobId, { phase: 'ingest_rag_failed', message: reason })
        FileLogger.error('external-jobs', 'Ingestion failed', err)
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'RAG Ingestion fehlgeschlagen', details: { reason } } })
      }

      const completed = await setJobCompleted({ ctx, result: { savedItemId } })
      
      // Aktualisiere Shadow-Twin-State: Setze processingStatus auf 'ready', da Job abgeschlossen ist
      if (job.shadowTwinState) {
        const updatedState = { ...job.shadowTwinState, processingStatus: 'ready' as const };
        await repo.setShadowTwinState(jobId, updatedState);
        FileLogger.info('callback-route', 'Shadow-Twin-State auf ready gesetzt', {
          jobId,
          shadowTwinFolderId: updatedState.shadowTwinFolderId
        });
      }
      
      // WICHTIG: Refresh sowohl Parent als auch Shadow-Twin-Verzeichnis (falls vorhanden)
      // Dies stellt sicher, dass beide Ordner aktualisiert werden und die Shadow-Twin-Analyse neu läuft
      const refreshShadowTwinFolderId = job.shadowTwinState?.shadowTwinFolderId
      const parentId = job.correlation?.source?.parentId || 'root'
      const refreshFolderIds = refreshShadowTwinFolderId && refreshShadowTwinFolderId !== parentId
        ? [parentId, refreshShadowTwinFolderId]
        : [parentId]
      
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
        result: { savedItemId: savedItemId || undefined },
        refreshFolderId: parentId, // Primary refresh folder (für Rückwärtskompatibilität)
        refreshFolderIds, // Array mit allen zu refreshenden Ordnern (Parent + Shadow-Twin)
        shadowTwinFolderId: refreshShadowTwinFolderId || null, // Shadow-Twin-Verzeichnis-ID für Client-Analyse
      });
      return NextResponse.json({ status: 'ok', jobId: completed.jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
    }

    // Sollte nicht erreicht werden
    return NextResponse.json({ status: 'ok', jobId, kind: 'noop_final' });
  } catch (err) {
    // Differenzierte Fehlerzuordnung (401/404/409/400)
    const anyErr = err as { code?: unknown; status?: unknown; message?: unknown } | undefined;
    const codeRaw = (anyErr && typeof anyErr.code === 'string') ? anyErr.code : undefined;
    const statusFromErr = (anyErr && typeof anyErr.status === 'number') ? anyErr.status : undefined;
    const status = statusFromErr
      ?? (codeRaw === 'unauthorized' ? 401
      : codeRaw === 'not_found' ? 404
      : codeRaw === 'conflict' ? 409
      : 400);
    const message = (anyErr && typeof anyErr.message === 'string') ? anyErr.message : (status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Invalid payload');
    const code = codeRaw || (status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'invalid_payload');
    // WICHTIG:
    // Transiente Netzwerkfehler dürfen einen Job nicht dauerhaft als failed markieren.
    // Sonst "endet" der Job-Span frühzeitig (setStatus() beendet root-span) und spätere erfolgreiche
    // Callbacks können die Timeline nicht mehr korrigieren (endedAt wird nur einmal gesetzt).
    const isTransientNetworkError =
      /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|fetch failed/i.test(message)
      || /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND/i.test(code);

    try {
      const { jobId } = await params;
      const repo = new ExternalJobsRepository();
      const job = await repo.get(jobId);
      if (job) {
        if (isTransientNetworkError) {
          bufferLog(jobId, { phase: 'transient_error', message });
          await repo.appendLog(jobId, { phase: 'transient_error', message, details: { code, status } } as unknown as Record<string, unknown>);
          try {
            await repo.traceAddEvent(jobId, {
              spanId: 'template',
              name: 'transient_error',
              level: 'warn',
              message,
              attributes: { code, status },
            })
          } catch {}
        } else {
          bufferLog(jobId, { phase: 'failed', message });
          await repo.appendLog(jobId, { phase: 'failed', message, details: { code, status } } as unknown as Record<string, unknown>);
        }
        // WICHTIG:
        // 401/unauthorized sind i.d.R. Auth-/Token-Themen (z.B. falscher Bearer-Token oder alte Callbacks).
        // Das darf einen bereits laufenden Job NICHT dauerhaft als failed markieren, sonst "flippt"
        // der Job-Status kurz auf failed und Tests/UI brechen ab, obwohl der korrekte Prozess später
        // erfolgreich fertig wird.
        if (status !== 401 && !isTransientNetworkError) {
          await handleJobErrorWithDetails(
            new Error(message),
            {
              jobId,
              userEmail: job.userEmail,
              jobType: job.job_type,
              fileName: job.correlation?.source?.name,
              sourceItemId: job.correlation?.source?.itemId,
            },
            repo,
            code,
            { status },
            'template'
          );
        }
      }
    } catch {
      // ignore secondary failures
    }
    return NextResponse.json({ error: message, code }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Sicherheit: Laufende Jobs nicht löschen
    if (job.status === 'running') return NextResponse.json({ error: 'Job läuft noch' }, { status: 409 });

    // WICHTIG: Watchdog stoppen, bevor der Job gelöscht wird
    try {
      clearWatchdog(jobId);
    } catch (error) {
      // Watchdog-Fehler nicht kritisch - Job wird trotzdem gelöscht
      FileLogger.warn('delete-route', 'Fehler beim Stoppen des Watchdogs', {
        jobId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const ok = await repo.delete(jobId);
    if (!ok) return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 });
    
    // Event-Bus benachrichtigen, damit UI aktualisiert wird
    getJobEventBus().emitUpdate(userEmail, {
      type: 'job_update',
      jobId,
      status: 'deleted',
      updatedAt: new Date().toISOString(),
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
    });
    
    return NextResponse.json({ status: 'deleted', jobId });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}


