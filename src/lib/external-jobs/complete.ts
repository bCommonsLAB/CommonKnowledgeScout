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

export async function setJobCompleted(args: CompleteArgs): Promise<JobResult> {
  const { ctx, result } = args
  const repo = new ExternalJobsRepository()
  try { await repo.updateStep(ctx.jobId, 'transform_template', { status: 'completed', endedAt: new Date() }) } catch {}
  await repo.setResult(ctx.jobId, ctx.job.payload || {}, { ...ctx.job.result, ...result })
  await repo.setStatus(ctx.jobId, 'completed')
  // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
  void drainBufferedLogs(ctx.jobId)
  return { status: 'ok', jobId: ctx.jobId }
}


