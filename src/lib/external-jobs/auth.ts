import type { RequestContext } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

export async function authorizeCallback(ctx: RequestContext): Promise<void> {
  const { jobId, job, callbackToken, internalBypass } = ctx
  const repo = new ExternalJobsRepository()

  if (!callbackToken && !internalBypass) {
    const incomingProcessId = (ctx.body?.process?.id && typeof ctx.body.process.id === 'string') ? ctx.body.process.id : (typeof ctx.body?.data?.processId === 'string' ? (ctx.body.data!.processId as string) : undefined)
    bufferLog(jobId, { phase: 'unauthorized_callback', message: 'callback_token fehlt', details: { incomingProcessId, reason: 'missing' } })
    await repo.appendLog(jobId, { phase: 'unauthorized_callback', message: 'callback_token fehlt', details: { incomingProcessId, reason: 'missing' } } as unknown as Record<string, unknown>)
    throw Object.assign(new Error('callback_token fehlt'), { code: 'unauthorized', status: 401 })
  }

  if (!internalBypass) {
    const tokenHash = repo.hashSecret(callbackToken as string)
    if (tokenHash !== job.jobSecretHash) {
      const incomingProcessId = (ctx.body?.process?.id && typeof ctx.body.process.id === 'string') ? ctx.body.process.id : (typeof ctx.body?.data?.processId === 'string' ? (ctx.body.data!.processId as string) : undefined)
      const safe = (s?: string) => (s ? s.slice(0, 12) : undefined)
      bufferLog(jobId, { phase: 'unauthorized_callback', message: 'Unauthorized callback', details: { incomingProcessId, reason: 'hash_mismatch', expected: safe(job.jobSecretHash), got: safe(tokenHash) } })
      await repo.appendLog(jobId, { phase: 'unauthorized_callback', message: 'Unauthorized callback', details: { incomingProcessId, reason: 'hash_mismatch', expected: safe(job.jobSecretHash), got: safe(tokenHash) } } as unknown as Record<string, unknown>)
      throw Object.assign(new Error('Unauthorized'), { code: 'unauthorized', status: 401 })
    }
  }
}

// Guard: akzeptiere nur passende processId, außer interner Bypass oder Template-Callback
export function guardProcessId(ctx: RequestContext, isTemplateCallback: boolean): void {
  const { jobId, job, internalBypass } = ctx
  if (internalBypass || isTemplateCallback) return
  const incomingProcessId = (ctx.body?.process?.id && typeof ctx.body.process.id === 'string') ? ctx.body.process.id : (typeof ctx.body?.data?.processId === 'string' ? (ctx.body.data!.processId as string) : undefined)
  const expected = job.processId
  if (expected && incomingProcessId && expected !== incomingProcessId) {
    bufferLog(jobId, { phase: 'process_guard', message: 'ProcessId mismatch', details: { incomingProcessId, expected } })
    throw Object.assign(new Error('ProcessId mismatch'), { code: 'conflict', status: 409 })
  }
}


