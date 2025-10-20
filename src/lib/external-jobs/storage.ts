import type { SaveMarkdownArgs, SaveMarkdownResult } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getJobEventBus } from '@/lib/events/job-event-bus'

export async function saveMarkdown(args: SaveMarkdownArgs): Promise<SaveMarkdownResult> {
  const { ctx, parentId, fileName, markdown } = args
  const repo = new ExternalJobsRepository()
  const provider = await getServerProvider(ctx.job.userEmail, ctx.job.libraryId)

  const file = new File([new Blob([markdown], { type: 'text/markdown' })], fileName, { type: 'text/markdown' })
  try {
    await repo.traceAddEvent(ctx.jobId, { spanId: 'template', name: 'postprocessing_save', attributes: { name: fileName } })
  } catch {}
  const saved = await provider.uploadFile(parentId, file)
  try { await repo.traceAddEvent(ctx.jobId, { spanId: 'template', name: 'stored_local', attributes: { savedItemId: saved.id, name: saved.metadata?.name } }) } catch {}
  bufferLog(ctx.jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' })

  try {
    const p = await provider.getPathById(parentId)
    const uniqueName = (saved.metadata?.name as string | undefined) || fileName
    await repo.appendLog(ctx.jobId, { phase: 'stored_path', message: `${p}/${uniqueName}` } as unknown as Record<string, unknown>)
    // @ts-expect-error custom field for UI refresh
    getJobEventBus().emitUpdate(ctx.job.userEmail, { type: 'job_update', jobId: ctx.jobId, status: 'running', progress: 98, updatedAt: new Date().toISOString(), message: 'stored_local', jobType: ctx.job.job_type, fileName: uniqueName, sourceItemId: ctx.job.correlation?.source?.itemId, refreshFolderId: parentId })
  } catch {}
  return { savedItemId: saved.id }
}


