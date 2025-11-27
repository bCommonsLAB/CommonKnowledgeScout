/**
 * @fileoverview External Jobs Complete - Job Completion Handler
 * 
 * @description
 * Handles job completion by updating job status, storing final results, updating
 * step status, and draining buffered logs. Marks job as completed in repository
 * and returns completion result.
 * 
 * @module external-jobs
 * 
 * @exports
 * - setJobCompleted: Marks job as completed with results
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback completes job
 * - src/app/api/external/jobs/[jobId]/start/route.ts: Job start may complete job
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for status updates
 * - @/lib/external-jobs-log-buffer: Log buffer draining
 * - @/types/external-jobs: Completion types
 */

import type { CompleteArgs, JobResult } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { drainBufferedLogs } from '@/lib/external-jobs-log-buffer'
import { clearWatchdog } from '@/lib/external-jobs-watchdog'

export async function setJobCompleted(args: CompleteArgs): Promise<JobResult> {
  const { ctx, result } = args
  const repo = new ExternalJobsRepository()
  try {
    const job = await repo.get(ctx.jobId)
    const phases = job && job.parameters && typeof job.parameters === 'object'
      ? (job.parameters as { phases?: { template?: boolean; ingest?: boolean } }).phases
      : undefined
    const policies = job && job.parameters && typeof job.parameters === 'object'
      ? (job.parameters as { policies?: { metadata?: string; ingest?: string } }).policies
      : undefined
    
    // Template-Step nur dann explizit abschließen, wenn die Template-Phase
    // in den Job-Parametern nicht deaktiviert wurde. Andernfalls würde eine
    // vorher gesetzte Skip-Begründung (z.B. reason: 'phase_disabled') wieder
    // überschrieben werden.
    const templateEnabled = phases ? phases.template !== false : true
    if (templateEnabled) {
      await repo.updateStep(ctx.jobId, 'transform_template', { status: 'completed', endedAt: new Date() })
    }
    
    // Ingest-Step als skipped markieren, wenn die Ingest-Phase deaktiviert ist
    // oder wenn die Policy auf 'ignore' gesetzt ist
    const ingestEnabled = phases ? phases.ingest !== false : true
    const ingestPolicy = policies?.ingest
    const shouldSkipIngest = !ingestEnabled || ingestPolicy === 'ignore'
    
    if (shouldSkipIngest) {
      // Prüfe, ob der Step bereits existiert und noch pending ist
      const existingStep = job?.steps?.find(s => s.name === 'ingest_rag')
      if (existingStep && existingStep.status === 'pending') {
        await repo.updateStep(ctx.jobId, 'ingest_rag', { 
          status: 'completed', 
          endedAt: new Date(), 
          details: { 
            skipped: true, 
            reason: !ingestEnabled ? 'phase_disabled' : 'policy_skip' 
          } 
        })
      }
    }
  } catch {}
  await repo.setResult(ctx.jobId, ctx.job.payload || {}, { ...ctx.job.result, ...result })
  await repo.setStatus(ctx.jobId, 'completed')
  // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
  void drainBufferedLogs(ctx.jobId)
  // WICHTIG: Watchdog stoppen, damit der Job nicht nach Timeout fälschlicherweise als "failed" markiert wird
  try {
    clearWatchdog(ctx.jobId)
  } catch (error) {
    // Watchdog-Fehler nicht kritisch - Job ist bereits abgeschlossen
    console.warn('[setJobCompleted] Fehler beim Stoppen des Watchdogs', {
      jobId: ctx.jobId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
  return { status: 'ok', jobId: ctx.jobId }
}


