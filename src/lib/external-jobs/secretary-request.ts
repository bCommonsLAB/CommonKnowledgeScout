/**
 * @fileoverview Secretary-Service-Request-Vorbereitung
 *
 * @description
 * Bereitet FormData und URL für Requests an den Secretary Service vor.
 * Unterstützt sowohl Mistral OCR als auch Standard PDF Process Endpoints.
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import { getSecretaryConfig } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'

export interface SecretaryRequestConfig {
  url: string
  formData: FormData
  headers: Record<string, string>
}

/**
 * Bereitet einen Request an den Secretary Service vor.
 *
 * @param job Job-Dokument
 * @param file PDF-Datei
 * @param callbackUrl Callback-URL für den Secretary Service
 * @param secret Callback-Token (wird in FormData eingefügt)
 * @returns Konfiguration für den Request
 */
export function prepareSecretaryRequest(
  job: ExternalJob,
  file: File,
  callbackUrl: string,
  secret: string
): SecretaryRequestConfig {
  const opts = (job.correlation?.options || {}) as Record<string, unknown>
  const { baseUrl, apiKey } = getSecretaryConfig()

  if (!apiKey) {
    throw new Error('SECRETARY_SERVICE_API_KEY fehlt')
  }

  const headers: Record<string, string> = {
    'x-worker': 'true',
    'Authorization': `Bearer ${apiKey}`,
    'X-Secretary-Api-Key': apiKey,
  }

  let url: string
  let formData: FormData

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  // --- Audio / Video (Secretary-only) ---
  if (job.job_type === 'audio') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/audio/process' : '/api/audio/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
    const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const template = typeof (job.parameters as Record<string, unknown> | undefined)?.['template'] === 'string'
      ? String((job.parameters as Record<string, unknown>)['template'])
      : undefined
    const phases = (() => {
      const raw = job.parameters && typeof job.parameters === 'object'
        ? (job.parameters as { phases?: unknown }).phases
        : undefined
      if (!raw || typeof raw !== 'object') return undefined
      return raw as { extract?: boolean; template?: boolean; ingest?: boolean }
    })()
    const isTemplatePhaseEnabled = phases?.template !== false
    // WICHTIG:
    // Wenn unsere Pipeline eine Template-Phase ausführt, darf Extract für Audio/Video nur das ROHE Transkript liefern.
    // Sonst liefert der Secretary schon template-transformierten Text zurück, und wir speichern diesen fälschlich als Transcript (*.de.md).
    const shouldSendTemplateToSecretary = !!(template && template.trim()) && !isTemplatePhaseEnabled

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
    if (shouldSendTemplateToSecretary) formData.append('template', template!.trim())
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Audio FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      sourceLanguage,
      useCache: String(useCache),
      templateRequested: !!(template && template.trim()),
      templateSentToSecretary: shouldSendTemplateToSecretary,
      templatePhaseEnabled: isTemplatePhaseEnabled,
      callbackUrl,
    })

    return { url, formData, headers }
  }

  if (job.job_type === 'video') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/video/process' : '/api/video/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
    const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const template = typeof (job.parameters as Record<string, unknown> | undefined)?.['template'] === 'string'
      ? String((job.parameters as Record<string, unknown>)['template'])
      : undefined
    const phases = (() => {
      const raw = job.parameters && typeof job.parameters === 'object'
        ? (job.parameters as { phases?: unknown }).phases
        : undefined
      if (!raw || typeof raw !== 'object') return undefined
      return raw as { extract?: boolean; template?: boolean; ingest?: boolean }
    })()
    const isTemplatePhaseEnabled = phases?.template !== false
    const shouldSendTemplateToSecretary = !!(template && template.trim()) && !isTemplatePhaseEnabled

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
    if (shouldSendTemplateToSecretary) formData.append('template', template!.trim())
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Video FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      sourceLanguage,
      useCache: String(useCache),
      templateRequested: !!(template && template.trim()),
      templateSentToSecretary: shouldSendTemplateToSecretary,
      templatePhaseEnabled: isTemplatePhaseEnabled,
      callbackUrl,
    })

    return { url, formData, headers }
  }

  // --- PDF (existing) ---
  const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native'

  if (extractionMethod === 'mistral_ocr') {
    // Mistral OCR Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api')
      ? '/pdf/process-mistral-ocr'
      : '/api/pdf/process-mistral-ocr'
    url = `${normalizedBaseUrl}${endpoint}`

    // Mistral OCR spezifische Parameter
    const includeOcrImages = typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true
    const includePageImages = typeof opts['includePageImages'] === 'boolean' ? opts['includePageImages'] : true
    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true

    formData = new FormData()
    formData.append('file', file)
    formData.append('includeImages', String(includeOcrImages)) // Mistral OCR Bilder als Base64
    formData.append('includePageImages', String(includePageImages)) // Seiten-Bilder als ZIP
    formData.append('useCache', String(useCache))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    // Optional: page_start und page_end
    if (typeof opts['page_start'] === 'number') {
      formData.append('page_start', String(opts['page_start']))
    }
    if (typeof opts['page_end'] === 'number') {
      formData.append('page_end', String(opts['page_end']))
    }

    FileLogger.info('secretary-request', 'Mistral OCR FormData erstellt', {
      jobId: job.jobId,
      url,
      hasFile: !!file,
      fileName: file.name,
      fileSize: file.size,
      includeOcrImages: String(includeOcrImages),
      includePageImages: String(includePageImages),
      useCache: String(useCache),
      callbackUrl,
    })
  } else {
    // Standard PDF Process Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/pdf/process' : '/api/pdf/process'
    url = `${normalizedBaseUrl}${endpoint}`

    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de')
    formData.append('extraction_method', extractionMethod)
    formData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true))
    const standardIncludeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false
    formData.append('includeImages', String(standardIncludeImages))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)

    FileLogger.info('secretary-request', 'Standard PDF Process FormData erstellt', {
      jobId: job.jobId,
      url,
      extractionMethod,
      callbackUrl,
    })
  }

  return { url, formData, headers }
}





