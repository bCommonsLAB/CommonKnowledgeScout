/**
 * @fileoverview External Jobs Authentication - Authorization and Bypass Checks
 * 
 * @description
 * Provides authentication and authorization utilities for external job processing.
 * Handles internal token validation, external job header checks, callback token
 * authorization, and process ID guarding. Supports bypass mechanisms for internal
 * worker requests and template callbacks.
 * 
 * @module external-jobs
 * 
 * @exports
 * - isInternalAuthorized: Checks if request is from internal worker
 * - hasInternalTokenBypass: Checks for internal token bypass
 * - hasExternalJobHeader: Checks for external job header
 * - isInternalOrExternalJobBypass: Combined bypass check
 * - authorizeCallback: Authorizes callback request with token validation
 * - guardProcessId: Guards against process ID mismatches
 * - InternalAuthCheck: Interface for internal auth check result
 * - BypassCheck: Interface for bypass check result
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback uses auth checks
 * - src/app/api/external/jobs/[jobId]/start/route.ts: Job start uses auth checks
 * - src/lib/external-jobs/context.ts: Context reader uses bypass checks
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for token validation
 * - @/lib/external-jobs-log-buffer: Log buffering for auth failures
 * - @/types/external-jobs: RequestContext type
 */

import type { NextRequest } from 'next/server'

export interface InternalAuthCheck { isInternal: boolean }
export interface BypassCheck { bypass: boolean; reason: 'internal-token' | 'external-job' | null }

function readHeaderCaseInsensitive(headers: Headers, name: string): string {
  return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || ''
}

export function isInternalAuthorized(request: NextRequest): InternalAuthCheck {
  const headerToken = readHeaderCaseInsensitive(request.headers, 'x-internal-token')
  const expected = process.env.INTERNAL_TEST_TOKEN || ''
  return { isInternal: Boolean(headerToken) && Boolean(expected) && headerToken === expected }
}

export function hasInternalTokenBypass(headers: Headers): boolean {
  const token = readHeaderCaseInsensitive(headers, 'x-internal-token')
  const expected = process.env.INTERNAL_TEST_TOKEN || ''
  return Boolean(token) && Boolean(expected) && token === expected
}

export function hasExternalJobHeader(headers: Headers): boolean {
  const jobHdr = readHeaderCaseInsensitive(headers, 'x-external-job')
  return typeof jobHdr === 'string' && jobHdr.length > 0
}

export function isInternalOrExternalJobBypass(request: NextRequest): BypassCheck {
  if (hasInternalTokenBypass(request.headers)) return { bypass: true, reason: 'internal-token' }
  if (hasExternalJobHeader(request.headers)) return { bypass: true, reason: 'external-job' }
  return { bypass: false, reason: null }
}

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
    /**
     * WICHTIG (Security + Praxis):
     * Der Secretary Service ruft unsere Callback-Route i.d.R. mit `Authorization: Bearer <SECRETARY_SERVICE_API_KEY>`
     * auf. Das ist *nicht* derselbe Secret wie unser per-Job `callback_token`.
     *
     * Wenn wir Bearer-Tokens immer als per-Job callback_token interpretieren, entsteht ein `hash_mismatch`
     * (und damit 401), obwohl der Worker-Callback legitim ist. Deshalb akzeptieren wir hier explizit
     * den Service-API-Key als gültigen Callback-Token.
     */
    const secretaryApiKey = process.env.SECRETARY_SERVICE_API_KEY || ''
    if (secretaryApiKey && callbackToken === secretaryApiKey) return

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


