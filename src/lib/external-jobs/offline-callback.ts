/**
 * @fileoverview Offline-Modus Callback-Integration
 *
 * @description
 * Im Offline-Modus (Electron) kann der Secretary Service die App nicht per Webhook
 * erreichen. Stattdessen werden die Ergebnisse (sync oder via SSE) direkt empfangen
 * und über einen internen HTTP-POST an die eigene Callback-Route weitergeleitet.
 * Dadurch wird die gesamte existierende Callback-Logik (Template, Ingest etc.)
 * wiederverwendet, ohne sie extrahieren zu müssen.
 *
 * @module external-jobs
 */

import { getSelfBaseUrl } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Normalisiert eine synchrone Secretary-Response (Audio/Video/Transformer)
 * in das Format, das die Callback-Route erwartet.
 *
 * Secretary synchrone Response:
 *   { status: "success", data: { transcription: {...}, result: {...} } }
 *
 * Callback-Route erwartet:
 *   { phase: "completed", data: { extracted_text: "...", transcription: {...} } }
 */
export function mapSyncResponseToCallbackBody(
  secretaryResponse: Record<string, unknown>,
  jobType: string
): Record<string, unknown> {
  const respData = (secretaryResponse.data ?? secretaryResponse) as Record<string, unknown>

  // Audio/Video: Secretary liefert transcription.text und/oder result
  if (jobType === 'audio' || jobType === 'video') {
    const transcription = respData.transcription as Record<string, unknown> | undefined
    const result = respData.result as Record<string, unknown> | undefined
    const extractedText = typeof respData.extracted_text === 'string'
      ? respData.extracted_text
      : (typeof transcription?.text === 'string' ? transcription.text : '')

    return {
      phase: 'completed',
      data: {
        extracted_text: extractedText,
        transcription: transcription ?? undefined,
        result: result ?? undefined,
        metadata: respData.metadata ?? undefined,
      },
    }
  }

  // Transformer: Secretary liefert result als transformierten Text
  if (jobType === 'transformer' || jobType === 'text') {
    return {
      phase: 'completed',
      data: {
        extracted_text: typeof respData.result === 'string'
          ? respData.result
          : (typeof respData.extracted_text === 'string' ? respData.extracted_text : ''),
        result: respData.result,
        metadata: respData.metadata ?? undefined,
      },
    }
  }

  // Fallback: Daten unverändert weiterleiten
  return {
    phase: 'completed',
    data: respData,
  }
}

/**
 * Wraps SSE-Completed-Daten in das Callback-Format.
 *
 * Seit dem Secretary Service Update liefert das SSE completed-Event
 * die gleiche data-Struktur wie der Webhook-Callback:
 *   { extracted_text: "...", metadata: {...}, pages_archive_url: "...", ... }
 *
 * Die Daten werden daher 1:1 als { phase: "completed", data: ... } durchgereicht.
 */
export function mapSSEResultToCallbackBody(
  sseResults: Record<string, unknown>,
  _jobType: string
): Record<string, unknown> {
  FileLogger.info('offline-callback', 'SSE→Callback Durchreichung', {
    sseResultKeys: Object.keys(sseResults),
    hasExtractedText: 'extracted_text' in sseResults,
    extractedTextLength: typeof sseResults.extracted_text === 'string' ? sseResults.extracted_text.length : 0,
    hasPagesArchiveUrl: !!sseResults.pages_archive_url,
    hasMistralOcrRawUrl: !!sseResults.mistral_ocr_raw_url,
  })

  // SSE-Format ist identisch mit Webhook-Format – kein Mapping nötig.
  return {
    phase: 'completed',
    data: sseResults,
  }
}

/**
 * Leitet das Ergebnis an die eigene Callback-Route weiter (Self-POST).
 * Nutzt den internen Token-Bypass, um die Callback-Authentifizierung zu umgehen.
 *
 * @param jobId ID des externen Jobs
 * @param callbackBody Normalisierter Callback-Body
 */
export async function postToSelfCallback(
  jobId: string,
  callbackBody: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const selfBase = getSelfBaseUrl()
  const callbackUrl = `${selfBase.replace(/\/$/, '')}/api/external/jobs/${jobId}`
  const internalToken = process.env.INTERNAL_TEST_TOKEN || ''

  if (!internalToken) {
    throw new Error('INTERNAL_TEST_TOKEN fehlt – wird für Offline-Callback benötigt')
  }

  const cbData = callbackBody.data as Record<string, unknown> | undefined
  FileLogger.info('offline-callback', 'Self-POST an Callback-Route', {
    jobId,
    callbackUrl,
    phase: callbackBody.phase,
    dataKeys: cbData ? Object.keys(cbData) : [],
    extractedTextLength: typeof cbData?.extracted_text === 'string' ? cbData.extracted_text.length : 0,
    hasMistralOcrRawUrl: !!cbData?.mistral_ocr_raw_url,
    hasPagesArchiveUrl: !!cbData?.pages_archive_url,
    hasImagesArchiveUrl: !!cbData?.images_archive_url,
    bodyJsonSize: JSON.stringify(callbackBody).length,
  })

  const resp = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': internalToken,
    },
    body: JSON.stringify(callbackBody),
  })

  const body = await resp.json().catch(() => null)

  if (!resp.ok) {
    FileLogger.error('offline-callback', 'Self-POST fehlgeschlagen', {
      jobId,
      status: resp.status,
      body,
    })
  }

  return { ok: resp.ok, status: resp.status, body }
}
