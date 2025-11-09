/**
 * @fileoverview External Jobs Provider Builder - Storage Provider Construction
 * 
 * @description
 * Builds storage provider for external job processing. Creates server-side provider
 * with error handling and logging. Updates job status on provider initialization
 * failures.
 * 
 * @module external-jobs
 * 
 * @exports
 * - buildProvider: Builds storage provider for job processing
 * 
 * @usedIn
 * - src/lib/external-jobs/preprocess.ts: Preprocessing uses provider builder
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback may use provider builder
 * 
 * @dependencies
 * - @/lib/storage/server-provider: Server provider creation
 * - @/lib/external-jobs-repository: Job repository for error handling
 * - @/lib/external-jobs-log-buffer: Log buffering
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

interface BuildProviderArgs {
  userEmail: string
  libraryId: string
  jobId: string
  repo: ExternalJobsRepository
}

export async function buildProvider(args: BuildProviderArgs) {
  const { userEmail, libraryId, jobId, repo } = args
  try {
    const provider = await getServerProvider(userEmail, libraryId)
    return provider
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Provider-Initialisierung fehlgeschlagen'
    bufferLog(jobId, { phase: 'provider_init_failed', message: reason })
    await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: reason } })
    await repo.setStatus(jobId, 'failed', { error: { code: 'CONFIG_ERROR', message: reason } })
    throw e
  }
}


