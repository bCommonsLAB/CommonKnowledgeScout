/**
 * @fileoverview External Jobs Progress Handler - Progress Update Processing
 * 
 * @description
 * Handles progress updates from external job callbacks. Extracts progress values,
 * phase information, and messages from callback body. Updates job status, emits
 * events, and bumps watchdog timer. Returns early response for progress-only updates.
 * 
 * @module external-jobs
 * 
 * @exports
 * - handleProgressIfAny: Processes progress updates if present
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback handles progress
 * 
 * @dependencies
 * - @/lib/external-jobs-watchdog: Watchdog timer management
 * - @/lib/external-jobs-repository: Job repository for status updates
 * - @/lib/events/job-event-bus: Event bus for real-time updates
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/types/external-jobs: RequestContext type
 */

import type { RequestContext } from '@/types/external-jobs'
import { bumpWatchdog } from '@/lib/external-jobs-watchdog'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'

export async function handleProgressIfAny(
  ctx: RequestContext,
  repo: ExternalJobsRepository,
  workerId?: string
): Promise<{ status: number; body: unknown } | null> {
  const { jobId, job, body } = ctx

  const progressValue = typeof (body as { progress?: unknown })?.progress === 'number'
    ? (body as { progress: number }).progress
    : typeof (body?.data as { progress?: unknown })?.progress === 'number'
      ? (body!.data as { progress: number }).progress
      : typeof (body as { percent?: unknown })?.percent === 'number'
        ? (body as { percent: number }).percent
        : typeof (body?.data as { percent?: unknown })?.percent === 'number'
          ? (body!.data as { percent: number }).percent
          : undefined

  const phase = (typeof body?.phase === 'string' && body.phase) || (typeof (body?.data as { phase?: unknown })?.phase === 'string' && (body!.data as { phase: string }).phase) || undefined
  const message = (typeof (body as { message?: unknown })?.message === 'string' && (body as { message: string }).message) || (typeof (body?.data as { message?: unknown })?.message === 'string' && (body!.data as { message: string }).message) || undefined

  const hasError = !!(body as { error?: unknown })?.error
  // WICHTIG: Bei Mistral OCR wird pages_archive_url verwendet, nicht images_archive_url
  // Beide URLs sollten als finales Payload erkannt werden
  const hasFinalPayload = !!(
    (body?.data as { extracted_text?: unknown })?.extracted_text || 
    (body?.data as { images_archive_url?: unknown })?.images_archive_url || 
    (body?.data as { pages_archive_url?: unknown })?.pages_archive_url ||
    // Mistral OCR: async webhooks may provide only url/metadata (indicator)
    (body?.data as { mistral_ocr_raw_url?: unknown })?.mistral_ocr_raw_url ||
    (body?.data as { mistral_ocr_raw_metadata?: unknown })?.mistral_ocr_raw_metadata ||
    (body?.data as { mistral_ocr_raw?: unknown })?.mistral_ocr_raw ||
    // Audio/Video: final webhook may contain transcription text
    (body?.data as { transcription?: { text?: unknown } })?.transcription?.text ||
    (body?.data as Record<string, unknown> | undefined)?.['text'] ||
    (body as { status?: unknown })?.status === 'completed' || 
    body?.phase === 'template_completed' ||
    // Treat "completed" as final so we do NOT short-circuit on progress handler
    body?.phase === 'completed'
  )

  if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
    // Timing: erstes Progress-Event nach Secretary-ACK messen (idempotent).
    // WICHTIG: Wir setzen nur einmal (guardKey), damit keine Duplikate bei vielen progress callbacks entstehen.
    try {
      const firstProgressAt = new Date().toISOString()
      const ackAtRaw = (job.parameters as Record<string, unknown> | undefined)?.timings
        && typeof (job.parameters as Record<string, unknown>)?.timings === 'object'
        ? (((job.parameters as Record<string, unknown>).timings as Record<string, unknown>)?.secretary as Record<string, unknown> | undefined)?.ackAt
        : undefined
      const ackAt = typeof ackAtRaw === 'string' ? ackAtRaw : undefined
      const ackToFirstProgressMs = ackAt ? Math.max(0, Date.parse(firstProgressAt) - Date.parse(ackAt)) : undefined
      const didSet = await repo.setSecretaryTimingIfMissing(
        jobId,
        {
          firstProgressAt,
          ...(typeof ackToFirstProgressMs === 'number' ? { ackToFirstProgressMs } : {}),
        },
        'firstProgressAt'
      )
      if (didSet) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'extract',
            name: 'secretary_first_progress',
            attributes: {
              firstProgressAt,
              phase: phase || 'progress',
              progress: progressValue,
              ...(typeof ackToFirstProgressMs === 'number' ? { ackToFirstProgressMs } : {}),
            },
          })
        } catch {}
      }
    } catch {}

    // Sicherstellen, dass die Extract-Phase als running markiert ist (Span-Erzeugung)
    try {
      const extractStepName =
        job.job_type === 'audio'
          ? 'extract_audio'
          : job.job_type === 'video'
            ? 'extract_video'
            : 'extract_pdf'
      const latest = await repo.get(jobId)
      const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === extractStepName) : undefined
      if (!st || (st.status !== 'running' && st.status !== 'completed' && st.status !== 'failed')) {
        await repo.updateStep(jobId, extractStepName, { status: 'running', startedAt: new Date() })
      }
    } catch {}
    
    // WICHTIG: Watchdog verlängern bei postprocessing Phase, besonders bei großen Dokumenten
    // Bei großen Dokumenten kann das Speichern der Bilder sehr lange dauern
    const isPostprocessing = phase === 'postprocessing'
    const extendedTimeout = isPostprocessing ? 300_000 : undefined // 5 Minuten für postprocessing
    bumpWatchdog(jobId, extendedTimeout)
    bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message })
    try { await repo.traceAddEvent(jobId, { spanId: 'extract', name: 'progress', attributes: { phase: phase || 'progress', progress: progressValue, message, workerId } }) } catch {}
    getJobEventBus().emitUpdate(job.userEmail, {
      type: 'job_update',
      jobId,
      status: 'running',
      phase: phase || 'progress',
      progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
      message,
      updatedAt: new Date().toISOString(),
      jobType: job.job_type,
      fileName: job.correlation?.source?.name,
      sourceItemId: job.correlation?.source?.itemId,
    })
    return { status: 200, body: { status: 'ok', jobId, kind: 'progress' } }
  }
  return null
}


