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

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
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
      const errorMsg = `Fehler beim Parsen der Transformer-Antwort: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      bufferLog(jobId, { 
        phase: 'transform_meta_error', 
        message: errorMsg
      })
      // Werfe Fehler, damit er im Trace-Event erfasst wird
      const error = new Error(errorMsg) as Error & { status?: number; statusText?: string }
      error.status = resp.status
      error.statusText = resp.statusText
      throw error
    })
    
    if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
      const d = (data as { data?: unknown }).data as { structured_data?: unknown } | undefined
      const structuredRaw = d?.structured_data
      const normalized = normalizeStructuredData(structuredRaw)
      if (normalized) {
        // Debug/Trace: Wir loggen NUR Keys + Längen, keine Inhalte (PII/Größe).
        // Ziel: sichtbar machen, ob Secretary z.B. `intro`, `worum`, `was` etc. tatsächlich liefert.
        try {
          const keys = Object.keys(normalized)
          const keysLimited = keys.slice(0, 50)
          const expectedBodyKeys = ['bodyInText', 'intro', 'worum', 'was', 'warum', 'wer', 'umsetzungsgrad', 'vorteile', 'bestpraxis', 'cta'] as const
          const keyPresence: Record<string, boolean> = {}
          const valueLengths: Record<string, number> = {}
          for (const k of expectedBodyKeys) {
            const v = normalized[k]
            keyPresence[k] = isNonEmptyString(v)
            valueLengths[k] = typeof v === 'string' ? v.length : 0
          }
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_response_structured_data',
            attributes: {
              keysCount: keys.length,
              keys: keysLimited,
              keysTruncated: keys.length > keysLimited.length,
              hasBodyInText: keyPresence.bodyInText,
              hasIntro: keyPresence.intro,
              hasWorum: keyPresence.worum,
              hasWas: keyPresence.was,
              hasWarum: keyPresence.warum,
              hasWer: keyPresence.wer,
              hasUmsetzungsgrad: keyPresence.umsetzungsgrad,
              hasVorteile: keyPresence.vorteile,
              hasBestpraxis: keyPresence.bestpraxis,
              hasCta: keyPresence.cta,
              bodyInTextLen: valueLengths.bodyInText,
              introLen: valueLengths.intro,
              worumLen: valueLengths.worum,
              wasLen: valueLengths.was,
              warumLen: valueLengths.warum,
              werLen: valueLengths.wer,
              umsetzungsgradLen: valueLengths.umsetzungsgrad,
              vorteileLen: valueLengths.vorteile,
              bestpraxisLen: valueLengths.bestpraxis,
              ctaLen: valueLengths.cta,
              // Extra: um zu sehen, ob Secretary überhaupt structured_data geliefert hat
              structuredDataType: structuredRaw === null ? 'null' : Array.isArray(structuredRaw) ? 'array' : typeof structuredRaw,
            }
          })
        } catch {
          // Trace-Logging darf die Pipeline nicht brechen
        }
        bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' })
        return { meta: normalized }
      } else {
        // Secretary Service hat erfolgreich geantwortet, aber kein gültiges structured_data zurückgegeben
        const errorMsg = `Transformer lieferte kein gültiges structured_data. Response-Struktur: ${JSON.stringify(data).substring(0, 500)}`
        bufferLog(jobId, { phase: 'transform_meta_failed', message: errorMsg })
        
        // Werfe Fehler mit Response-Details, damit er im Trace-Event erfasst wird
        const error = new Error(errorMsg) as Error & { 
          status?: number
          statusText?: string
          responseData?: unknown
        }
        error.status = resp.status
        error.statusText = resp.statusText
        error.responseData = data
        throw error
      }
    }
    
    // HTTP-Status nicht OK, aber Response erhalten
    // Versuche, detaillierte Fehlermeldung aus Response-Body zu extrahieren
    let errorText = `HTTP ${resp.status}: ${resp.statusText}`
    let responseData: unknown = data
    
    if (data && typeof data === 'object' && data !== null) {
      // Versuche verschiedene Fehlerfelder zu finden
      if ('error' in data) {
        errorText = String((data as { error?: unknown }).error)
      } else if ('message' in data) {
        errorText = String((data as { message?: unknown }).message)
      } else if ('detail' in data) {
        errorText = String((data as { detail?: unknown }).detail)
      } else {
        // Verwende JSON-String der Response als Fehlermeldung (erste 500 Zeichen)
        const dataStr = JSON.stringify(data).substring(0, 500)
        errorText = `HTTP ${resp.status}: ${resp.statusText}. Response: ${dataStr}`
      }
      responseData = data
    } else if (typeof data === 'string') {
      errorText = `HTTP ${resp.status}: ${resp.statusText}. Response: ${data.substring(0, 500)}`
      responseData = data
    }
    
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
      responseData?: unknown
    }
    error.status = resp.status
    error.statusText = resp.statusText
    error.contentLength = estimatedContentLength
    error.maxContentLength = maxContentLength
    error.extractedTextLen = textLength
    error.templateContentLen = templateLength
    error.is413Error = resp.status === 413
    error.responseData = responseData // Speichere Response-Daten für Debugging
    
    throw error
  } catch (error) {
    // Fehler beim HTTP-Request (Network, Timeout, HttpError, etc.)
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
        responseData?: unknown
      }
      
      // Wenn es ein HttpError ist, extrahiere responseBody (falls vorhanden)
      // HttpError hat jetzt ein responseBody-Feld (siehe fetch-with-timeout.ts)
      if ('status' in error && 'statusText' in error) {
        // HttpError hat möglicherweise responseBody
        const httpError = error as { responseBody?: unknown }
        if (httpError.responseBody) {
          enhancedError.responseData = httpError.responseBody
          
          // Extrahiere Fehlermeldung aus responseBody, falls vorhanden
          // Secretary Service Format: { status: "error", error: { message: "..." } }
          if (typeof httpError.responseBody === 'object' && httpError.responseBody !== null) {
            const body = httpError.responseBody as Record<string, unknown>
            if ('error' in body && typeof body.error === 'object' && body.error !== null && 'message' in body.error) {
              const errorMsg = String((body.error as { message?: unknown }).message)
              // Überschreibe error.message mit der detaillierten Fehlermeldung
              enhancedError.message = errorMsg
            }
          }
        }
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


