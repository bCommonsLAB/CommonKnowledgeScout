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
  const hasFinalPayload = !!((body?.data as { extracted_text?: unknown })?.extracted_text || (body?.data as { images_archive_url?: unknown })?.images_archive_url || (body as { status?: unknown })?.status === 'completed' || body?.phase === 'template_completed')

  if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
    // Sicherstellen, dass die Extract-Phase als running markiert ist (Span-Erzeugung)
    try {
      const latest = await repo.get(jobId)
      const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'extract_pdf') : undefined
      if (!st || (st.status !== 'running' && st.status !== 'completed' && st.status !== 'failed')) {
        await repo.updateStep(jobId, 'extract_pdf', { status: 'running', startedAt: new Date() })
      }
    } catch {}
    bumpWatchdog(jobId)
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


