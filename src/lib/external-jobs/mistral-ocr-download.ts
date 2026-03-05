/**
 * @fileoverview Mistral OCR Raw-Daten-Download
 *
 * @description
 * Lädt Mistral OCR Raw-Daten über den Download-Endpoint, wenn nur URL/Metadaten
 * im Webhook vorhanden sind (asynchroner Webhook-Modus).
 *
 * @module external-jobs
 */

import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { resolveSecretaryUrl, getSecretaryAuthHeaders, type SecretaryUrlConfig } from './secretary-url'

/**
 * Lädt Mistral OCR Raw-Daten über den Download-Endpoint.
 *
 * @param body Callback-Body vom Secretary Service
 * @param jobId Job-ID
 * @param secretaryUrlConfig Optionale Library-spezifische Secretary-Config (Desktop-Modus)
 * @returns Mistral OCR Raw-Daten oder null bei Fehler
 */
export async function downloadMistralOcrRaw(
  body: { process?: { id?: unknown }; data?: { processId?: unknown; mistral_ocr_raw_url?: unknown; mistral_ocr_raw_metadata?: unknown; mistral_ocr_raw?: unknown } },
  jobId: string,
  secretaryUrlConfig?: SecretaryUrlConfig
): Promise<unknown> {
  const mistralOcrRawUrl = body?.data?.mistral_ocr_raw_url as string | undefined
  const mistralOcrRawMetadata = body?.data?.mistral_ocr_raw_metadata

  // Wenn keine URL vorhanden, nichts zu tun
  if (!mistralOcrRawUrl && !mistralOcrRawMetadata) {
    return null
  }

  // Wenn bereits vollständige Daten vorhanden (Legacy), diese zurückgeben
  const existingRaw = body?.data?.mistral_ocr_raw
  if (existingRaw) {
    return existingRaw
  }

  try {
    // Extrahiere job_id aus Webhook-Body (process.id oder data.processId)
    const secretaryJobId: string | undefined =
      (body?.process && typeof body.process.id === 'string')
        ? body.process.id
        : typeof body?.data?.processId === 'string'
          ? body.data.processId
          : undefined

    if (!secretaryJobId) {
      bufferLog(jobId, {
        phase: 'mistral_ocr_raw_download_error',
        message: 'Keine job_id im Webhook gefunden (process.id oder data.processId fehlt)',
      })
      return null
    }

    const endpoint = `/api/pdf/jobs/${secretaryJobId}/mistral-ocr-raw`
    const downloadUrl = resolveSecretaryUrl(endpoint, secretaryUrlConfig)
    const headers = getSecretaryAuthHeaders(secretaryUrlConfig)

    bufferLog(jobId, {
      phase: 'mistral_ocr_raw_download_start',
      message: `Lade Mistral OCR Raw-Daten von Download-Endpoint: ${downloadUrl}`,
      secretaryJobId,
    })

    const resp = await fetch(downloadUrl, { method: 'GET', headers })
    if (resp.ok) {
      const data = await resp.json()
      bufferLog(jobId, {
        phase: 'mistral_ocr_raw_downloaded',
        message: 'Mistral OCR Raw-Daten erfolgreich vom Download-Endpoint heruntergeladen',
      })
      return data
    } else {
      const errorText = await resp.text().catch(() => '')
      bufferLog(jobId, {
        phase: 'mistral_ocr_raw_download_failed',
        message: `Download fehlgeschlagen: ${resp.status} ${errorText.substring(0, 200)}`,
      })
      return null
    }
  } catch (error) {
    bufferLog(jobId, {
      phase: 'mistral_ocr_raw_download_error',
      message: `Fehler beim Download: ${error instanceof Error ? error.message : String(error)}`,
    })
    return null
  }
}

