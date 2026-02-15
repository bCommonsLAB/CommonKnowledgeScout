/**
 * @fileoverview Secretary-Service-Request-Vorbereitung
 *
 * @description
 * Bereitet FormData und URL für Requests an den Secretary Service vor.
 * Unterstützt: Audio, Video, Office (DOCX/XLSX/PPTX), PDF (Mistral OCR + Standard).
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
    // Template gehört zur Transformations-Phase, nicht zur Extract-Phase.
    // Extract liefert immer nur das rohe Transkript; Template-Transformation erfolgt lokal in phase-template.ts.
    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
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
    // Template gehört zur Transformations-Phase, nicht zur Extract-Phase.
    // Extract liefert immer nur das rohe Transkript; Template-Transformation erfolgt lokal in phase-template.ts.
    formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', targetLanguage)
    formData.append('source_language', sourceLanguage)
    // Secretary uses `useCache` (see existing Next proxy routes)
    formData.append('useCache', String(useCache))
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
      callbackUrl,
    })

    return { url, formData, headers }
  }

  // --- Office (DOCX/XLSX/PPTX) - Pipeline A: python-only ---
  // POST /api/office/process: Office → Markdown + Images + Thumbnails
  if (job.job_type === 'office') {
    const endpoint = normalizedBaseUrl.endsWith('/api') ? '/office/process' : '/api/office/process'
    url = `${normalizedBaseUrl}${endpoint}`

    const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true
    const includeImages = typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : true
    const includePreviews = typeof opts['includePreviews'] === 'boolean' ? opts['includePreviews'] : true
    const forceRefresh = typeof opts['force_refresh'] === 'boolean' ? opts['force_refresh'] : false

    formData = new FormData()
    formData.append('file', file)
    formData.append('useCache', String(useCache))
    formData.append('includeImages', String(includeImages))
    formData.append('includePreviews', String(includePreviews))
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)
    formData.append('jobId', job.jobId)
    formData.append('force_refresh', String(forceRefresh))

    FileLogger.info('secretary-request', 'Office FormData erstellt', {
      jobId: job.jobId,
      url,
      fileName: file.name,
      fileSize: file.size,
      useCache: String(useCache),
      includeImages: String(includeImages),
      includePreviews: String(includePreviews),
      callbackUrl,
    })

    return { url, formData, headers }
  }

  // --- PDF (existing) ---
  // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
  const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'mistral_ocr'

  if (extractionMethod === 'mistral_ocr') {
    // Mistral OCR Endpoint
    const endpoint = normalizedBaseUrl.endsWith('/api')
      ? '/pdf/process-mistral-ocr'
      : '/api/pdf/process-mistral-ocr'
    url = `${normalizedBaseUrl}${endpoint}`

    // Mistral OCR spezifische Parameter
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    const includePageImages = typeof opts['includePageImages'] === 'boolean' ? opts['includePageImages'] : true
    const includeOcrImages = typeof opts['includeOcrImages'] === 'boolean' ? opts['includeOcrImages'] : true
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





