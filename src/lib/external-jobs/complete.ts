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


