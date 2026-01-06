/**
 * @fileoverview External Jobs Context Reader - Request Context Parsing
 * 
 * @description
 * Parses and validates request context for external job callbacks. Extracts job data,
 * callback tokens, and request body. Handles internal bypass checks and validates
 * job existence. Creates RequestContext object used throughout the orchestration pipeline.
 * 
 * @module external-jobs
 * 
 * @exports
 * - readContext: Main function to read and parse request context
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback uses context reader
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for job lookup
 * - @/lib/external-jobs/auth: Internal bypass check
 * - @/types/external-jobs: RequestContext and callback body types
 */

import type { NextRequest } from 'next/server'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { RequestContext, ExternalCallbackBody, createExternalJobError } from '@/types/external-jobs'
import { hasInternalTokenBypass } from '@/lib/external-jobs/auth'

function parseBodySafe(jsonRaw: unknown): ExternalCallbackBody {
  if (jsonRaw && typeof jsonRaw === 'object' && !Array.isArray(jsonRaw)) return jsonRaw as ExternalCallbackBody
  return {}
}

function readCallbackToken(request: NextRequest, body: ExternalCallbackBody): string | undefined {
  if (typeof body?.callback_token === 'string' && body.callback_token.trim().length > 0) return body.callback_token.trim()
  const h1 = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token')
  if (h1 && h1.trim().length > 0) return h1.trim()
  // Secretary Service sendet in manchen Flows `X-Service-Token` statt `Authorization: Bearer ...`.
  // Wenn wir das nicht auslesen, fallen wir ggf. auf ein falsches Bearer-Token zurück → hash_mismatch.
  const svc = request.headers.get('x-service-token') || request.headers.get('X-Service-Token')
  if (svc && svc.trim().length > 0) return svc.trim()
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (auth && auth.startsWith('Bearer ')) return auth.substring('Bearer '.length)
  return undefined
}

function isInternalBypass(request: NextRequest): boolean {
  return hasInternalTokenBypass(request.headers)
}

export async function readContext(args: { request: NextRequest; jobId: string }): Promise<RequestContext> {
  const { request, jobId } = args
  if (!jobId) throw Object.assign(new Error('jobId erforderlich'), { code: 'bad_request', status: 400 } satisfies Partial<ReturnType<typeof createExternalJobError>>)

  const repo = new ExternalJobsRepository()
  const job = await repo.get(jobId)
  if (!job) throw Object.assign(new Error('Job nicht gefunden'), { code: 'not_found', status: 404 } satisfies Partial<ReturnType<typeof createExternalJobError>>)

  const raw = await request.json().catch(() => ({}))
  const body = parseBodySafe(raw)
  const callbackToken = readCallbackToken(request, body)
  const internalBypass = isInternalBypass(request)

  return { request, jobId, job, body, callbackToken, internalBypass }
}


