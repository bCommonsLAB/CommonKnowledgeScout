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
 * Normalisiert ein SSE-Completed-Event (PDF/Office) in das Callback-Format.
 *
 * SSE completed Event:
 *   { results: { markdown_content: "...", structured_data: {...} } }
 *
 * Callback-Route erwartet:
 *   { phase: "completed", data: { extracted_text: "...", metadata: {...} } }
 */
export function mapSSEResultToCallbackBody(
  sseResults: Record<string, unknown>,
  jobType: string
): Record<string, unknown> {
  // PDF: SSE liefert results.markdown_content / results.structured_data
  if (jobType === 'pdf') {
    const markdownContent = sseResults.markdown_content as string | undefined
    const structuredData = sseResults.structured_data as Record<string, unknown> | undefined
    const extractedText = markdownContent
      ?? (structuredData?.extracted_text as string | undefined)
      ?? ''

    return {
      phase: 'completed',
      data: {
        extracted_text: extractedText,
        metadata: structuredData?.metadata ?? sseResults.metadata ?? undefined,
        // Mistral OCR spezifische Felder weiterleiten
        mistral_ocr_raw_url: sseResults.mistral_ocr_raw_url ?? undefined,
        mistral_ocr_raw_metadata: sseResults.mistral_ocr_raw_metadata ?? undefined,
        pages_archive_url: sseResults.pages_archive_url ?? undefined,
        images_archive_url: sseResults.images_archive_url ?? undefined,
      },
    }
  }

  // Office: Ähnlich wie PDF
  if (jobType === 'office') {
    return {
      phase: 'completed',
      data: {
        extracted_text: (sseResults.markdown_content as string) ?? '',
        metadata: sseResults.metadata ?? undefined,
        images_archive_url: sseResults.images_archive_url ?? undefined,
      },
    }
  }

  // Fallback
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

  FileLogger.info('offline-callback', 'Self-POST an Callback-Route', {
    jobId,
    callbackUrl,
    phase: callbackBody.phase,
    dataKeys: callbackBody.data && typeof callbackBody.data === 'object'
      ? Object.keys(callbackBody.data as Record<string, unknown>)
      : [],
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
