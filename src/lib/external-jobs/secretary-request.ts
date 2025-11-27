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
  const extractionMethod = typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native'
  const { baseUrl, apiKey } = getSecretaryConfig()

  if (!apiKey) {
    throw new Error('SECRETARY_SERVICE_API_KEY fehlt')
  }

  const headers: Record<string, string> = {
    'x-worker': 'true',
    'Authorization': `Bearer ${apiKey}`,
    'X-Service-Token': apiKey,
  }

  let url: string
  let formData: FormData

  if (extractionMethod === 'mistral_ocr') {
    // Mistral OCR Endpoint
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
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
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
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





