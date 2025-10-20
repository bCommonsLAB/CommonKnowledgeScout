import type { NextRequest } from 'next/server'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { RequestContext, ExternalCallbackBody, createExternalJobError } from '@/types/external-jobs'

function parseBodySafe(jsonRaw: unknown): ExternalCallbackBody {
  if (jsonRaw && typeof jsonRaw === 'object' && !Array.isArray(jsonRaw)) return jsonRaw as ExternalCallbackBody
  return {}
}

function readCallbackToken(request: NextRequest, body: ExternalCallbackBody): string | undefined {
  if (typeof body?.callback_token === 'string' && body.callback_token.trim().length > 0) return body.callback_token.trim()
  const h1 = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token')
  if (h1 && h1.trim().length > 0) return h1.trim()
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (auth && auth.startsWith('Bearer ')) return auth.substring('Bearer '.length)
  return undefined
}

function isInternalBypass(request: NextRequest): boolean {
  const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token')
  const envToken = process.env.INTERNAL_TEST_TOKEN || ''
  return !!t && !!envToken && t === envToken
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


