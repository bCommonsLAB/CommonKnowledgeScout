/**
 * @fileoverview External Jobs Template Run - Template Transformation Execution
 * 
 * @description
 * Executes template transformation via Secretary Service. Calls the template transformer
 * endpoint with extracted text and template content, normalizes the structured data response,
 * and returns frontmatter metadata. Handles response parsing and error cases.
 * 
 * @module external-jobs
 * 
 * @exports
 * - runTemplateTransform: Executes template transformation
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback uses template runner
 * 
 * @dependencies
 * - @/lib/secretary/adapter: Secretary Service adapter for API calls
 * - @/lib/env: Environment helpers for Secretary config
 * - @/lib/external-jobs-repository: Job repository for logging
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/types/external-jobs: Template run types
 */

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

  // Berechne Content-Length des Requests (JSON: text + template_content + andere Felder)
  const textLength = (extractedText || '').length
  const templateLength = templateContent.length
  // JSON-Overhead: JSON-Struktur, Keys, Escaping, andere Felder
  // Geschätzt: ~300 Bytes für JSON-Struktur + Escaping-Overhead für große Strings
  const jsonOverhead = Math.ceil((textLength + templateLength) * 0.1) // ~10% für JSON-Escaping
  const estimatedContentLength = textLength + templateLength + jsonOverhead + 300
  
  try { 
    await repo.traceAddEvent(jobId, { 
      spanId: 'template', 
      name: 'template_request_start', 
      attributes: { 
        url: transformerUrl, 
        method: 'POST', 
        targetLanguage, 
        templateContentLen: templateContent.length,
        extractedTextLen: textLength,
        estimatedContentLength
      } 
    }) 
  } catch {}
  
  try {
    const resp = await callTemplateTransform({ 
      url: transformerUrl, 
      text: extractedText || '', 
      targetLanguage, 
      templateContent, 
      apiKey, 
      timeoutMs: Number(process.env.EXTERNAL_TEMPLATE_TIMEOUT_MS || process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 600000) 
    })
    
    const data: unknown = await resp.json().catch((parseError) => {
      bufferLog(jobId, { 
        phase: 'transform_meta_error', 
        message: `Fehler beim Parsen der Transformer-Antwort: ${parseError instanceof Error ? parseError.message : String(parseError)}` 
      })
      return {}
    })
    
    if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
      const d = (data as { data?: unknown }).data as { structured_data?: unknown } | undefined
      const normalized = normalizeStructuredData(d?.structured_data)
      if (normalized) {
        bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' })
      } else {
        bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' })
      }
      return { meta: normalized }
    }
    
    // HTTP-Status nicht OK, aber Response erhalten
    const errorText = typeof data === 'object' && data !== null && 'error' in data 
      ? String((data as { error?: unknown }).error)
      : `HTTP ${resp.status}: ${resp.statusText}`
    
    // Extrahiere Max-Content-Length aus Response-Headers (falls vorhanden)
    const maxContentLength = resp.headers.get('x-max-content-length') 
      || resp.headers.get('x-content-length-max')
      || resp.headers.get('content-length-max')
      || (resp.status === 413 ? 'Limit überschritten (HTTP 413)' : 'unbekannt')
    
    // Erweitertes Error-Objekt mit strukturierten Informationen für phase-template.ts
    const error = new Error(errorText) as Error & {
      status?: number
      statusText?: string
      contentLength?: number
      maxContentLength?: string
      extractedTextLen?: number
      templateContentLen?: number
      is413Error?: boolean
    }
    error.status = resp.status
    error.statusText = resp.statusText
    error.contentLength = estimatedContentLength
    error.maxContentLength = maxContentLength
    error.extractedTextLen = textLength
    error.templateContentLen = templateLength
    error.is413Error = resp.status === 413
    
    throw error
  } catch (error) {
    // Fehler beim HTTP-Request (Network, Timeout, etc.)
    // Erweitere Error-Objekt mit strukturierten Informationen für phase-template.ts
    if (error instanceof Error) {
      const errorMessage = error.message
      const is413Error = errorMessage.includes('413') || errorMessage.includes('REQUEST ENTITY TOO LARGE')
      
      // Erweitertes Error-Objekt mit strukturierten Informationen
      const enhancedError = error as Error & {
        status?: number
        statusText?: string
        contentLength?: number
        maxContentLength?: string
        extractedTextLen?: number
        templateContentLen?: number
        is413Error?: boolean
        errorType?: string
        url?: string
      }
      
      // Wenn Error bereits erweitert wurde (z.B. von HttpError), diese Properties übernehmen
      if (!enhancedError.contentLength) {
        enhancedError.contentLength = estimatedContentLength
        enhancedError.extractedTextLen = textLength
        enhancedError.templateContentLen = templateLength
        enhancedError.is413Error = is413Error
        enhancedError.errorType = error.name
        enhancedError.url = transformerUrl
      }
      
      throw enhancedError
    }
    
    // Nicht-Error-Objekte weiterwerfen
    throw error
  }
}


