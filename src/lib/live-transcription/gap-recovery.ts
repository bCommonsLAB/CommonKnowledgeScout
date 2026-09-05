/**
 * @fileoverview Nacharbeit von Verbindungsluecken
 *
 * @description
 * Schickt den Mitschnitt einer Stoerung an die bestehende Batch-Transkription des
 * Secretary Service. Der zurueckkommende Text wird an der Stelle eingesetzt, an der
 * die Live-Erkennung ausgesetzt hat.
 *
 * Damit gilt: Was gesprochen wurde, ist entweder live erkannt, aus dem Puffer
 * nachgesendet oder aus diesem Mitschnitt nachgearbeitet worden.
 *
 * @module live-transcription
 *
 * @exports
 * - recoverGapText: Transkribiert den Mitschnitt einer Stoerung nach
 *
 * @dependencies
 * - @/lib/secretary/extract-audio-text: Liest den Text aus der Dienst-Antwort
 */

import { extractSecretaryAudioText } from '@/lib/secretary/extract-audio-text'

export interface GapRecoveryOptions {
  blob: Blob
  /** Endpunkt der Batch-Transkription (angemeldet oder oeffentlich). */
  endpoint: string
  /** Zusaetzliche Formularfelder, z.B. libraryId/eventFileId/writeKey im Public-Flow. */
  extraFormFields?: Record<string, string>
  sourceLanguage?: string
  targetLanguage?: string
  signal?: AbortSignal
}

function fileNameFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'luecke.mp4'
  return 'luecke.webm'
}

/**
 * Transkribiert den Mitschnitt einer Stoerung.
 *
 * @throws Error wenn der Dienst ablehnt oder keinen Text liefert. Der Aufrufer
 *         markiert die Luecke dann als gescheitert und behaelt den Mitschnitt —
 *         verworfen wird nichts.
 */
export async function recoverGapText(options: GapRecoveryOptions): Promise<string> {
  const { blob, endpoint, extraFormFields = {}, sourceLanguage = 'de', targetLanguage = 'de' } = options

  if (blob.size <= 0) {
    throw new Error('Der Mitschnitt der Stoerung ist leer.')
  }

  const mimeType = blob.type || 'audio/webm'
  const formData = new FormData()
  formData.append('file', new File([blob], fileNameFor(mimeType), { type: mimeType }))
  formData.append('source_language', sourceLanguage)
  formData.append('target_language', targetLanguage)
  for (const [key, value] of Object.entries(extraFormFields)) {
    if (value) formData.append(key, value)
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    signal: options.signal,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${response.status}`
    throw new Error(message)
  }

  const text = extractSecretaryAudioText(data).trim()
  if (!text) {
    throw new Error('Die Nacharbeit hat keinen Text ergeben.')
  }
  return text
}
