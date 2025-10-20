import type { CompleteArgs, JobResult } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { drainBufferedLogs } from '@/lib/external-jobs-log-buffer'

export async function setJobCompleted(args: CompleteArgs): Promise<JobResult> {
  const { ctx, result } = args
  const repo = new ExternalJobsRepository()
  // Dedupe: Transform-Template nur dann abschließen, wenn noch nicht abgeschlossen/fehlgeschlagen
  try {
    const latest = await repo.get(ctx.jobId)
    const st = Array.isArray(latest?.steps) ? latest!.steps!.find(s => s?.name === 'transform_template') : undefined
    const needsCompletion = !st || (st.status !== 'completed' && st.status !== 'failed')
    if (needsCompletion) {
      await repo.updateStep(ctx.jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { source: 'complete' } })
    }
  } catch {}
  await repo.setResult(ctx.jobId, ctx.job.payload || {}, { ...ctx.job.result, ...result })
  await repo.setStatus(ctx.jobId, 'completed')
  // Buffered Logs nicht erneut in trace persistieren – Replays vermeiden
  void drainBufferedLogs(ctx.jobId)
  return { status: 'ok', jobId: ctx.jobId }
}


