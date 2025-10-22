import type { TemplateRunArgs, TemplateRunResult, Frontmatter } from '@/types/external-jobs'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { callTemplateTransform } from '@/lib/secretary/adapter'
import { getSecretaryConfig } from '@/lib/env'

function normalizeStructuredData(raw: unknown): Frontmatter | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: Record<string, unknown> = { ...r }
  // shortTitle Varianten bereinigen
  const cand = (r['shortTitle'] ?? r['shortTitel'] ?? r['shortTitlel']) as unknown
  if (typeof cand === 'string') {
    const cleaned = cand.replace(/[.!?]+$/g, '').trim()
    out['shortTitle'] = cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned
  }
  delete out['shortTitel']
  delete out['shortTitlel']
  return out as Frontmatter
}

export async function runTemplateTransform(args: TemplateRunArgs): Promise<TemplateRunResult> {
  const { ctx, extractedText, templateContent, targetLanguage } = args
  const repo = new ExternalJobsRepository()
  const jobId = ctx.jobId
  const { baseUrl, apiKey } = getSecretaryConfig()
  const transformerUrl = `${baseUrl}/transformer/template`

  try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_request_start', attributes: { url: transformerUrl, method: 'POST', targetLanguage, templateContentLen: templateContent.length } }) } catch {}
  const resp = await callTemplateTransform({ url: transformerUrl, text: extractedText || '', targetLanguage, templateContent, apiKey, timeoutMs: Number(process.env.EXTERNAL_TEMPLATE_TIMEOUT_MS || process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 600000) })
  const data: unknown = await resp.json().catch(() => ({}))
  if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
    const d = (data as { data?: unknown }).data as { structured_data?: unknown } | undefined
    const normalized = normalizeStructuredData(d?.structured_data)
    if (normalized) bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' })
    else bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' })
    return { meta: normalized }
  }
  bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' })
  return { meta: null }
}


