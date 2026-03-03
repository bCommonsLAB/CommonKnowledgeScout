/**
 * @fileoverview SSE-Client für den Secretary Service (Offline/Electron-Modus)
 *
 * @description
 * Im Offline-Modus (Electron) kann der Secretary Service die App nicht per Webhook
 * erreichen. Stattdessen wird ein SSE-Stream geöffnet, um Job-Ergebnisse abzuholen.
 * Wird nur für asynchrone Endpoints benötigt (PDF, Office), da Audio/Video/Transformer
 * ohne callback_url synchron antworten.
 *
 * @module external-jobs
 */

import { getSecretaryConfig } from '@/lib/env'
import { FileLogger } from '@/lib/debug/logger'

/** SSE-Event vom Secretary Service */
export interface SecretarySSEEvent {
  event: string
  data: {
    phase: string
    message?: string
    job?: { id: string }
    process?: { id: string; main_processor?: string }
    data?: {
      progress?: number
      results?: Record<string, unknown>
    }
    error?: { code?: string; message?: string }
  }
}

/** Callback für Fortschritts-Updates */
export type ProgressCallback = (progress: number, message: string) => void

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000
const STREAM_TIMEOUT_MS = 10 * 60 * 1000 // 10 Minuten

/**
 * Öffnet einen SSE-Stream zum Secretary Service und wartet auf das Ergebnis.
 * Gibt bei `completed` die Ergebnis-Daten zurück, wirft bei `error`/`timeout`.
 *
 * @param secretaryJobId Job-ID vom Secretary Service (aus der 202-Response)
 * @param onProgress Optionaler Callback für Fortschritts-Updates
 * @returns Ergebnis-Daten aus dem `completed`-Event
 */
export async function streamSecretaryJob(
  secretaryJobId: string,
  onProgress?: ProgressCallback
): Promise<Record<string, unknown>> {
  const { baseUrl, apiKey } = getSecretaryConfig()
  if (!apiKey) throw new Error('SECRETARY_SERVICE_API_KEY fehlt')

  const normalizedBase = baseUrl.replace(/\/$/, '')
  const streamUrl = normalizedBase.endsWith('/api')
    ? `${normalizedBase}/jobs/${secretaryJobId}/stream`
    : `${normalizedBase}/api/jobs/${secretaryJobId}/stream`

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await readSSEStream(streamUrl, apiKey, secretaryJobId, onProgress)
      return result
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES - 1
      FileLogger.warn('secretary-sse', `SSE-Stream fehlgeschlagen (Versuch ${attempt + 1}/${MAX_RETRIES})`, {
        secretaryJobId,
        error: err instanceof Error ? err.message : String(err),
      })

      if (isLastAttempt) throw err

      // Prüfen ob der Job bereits fertig ist (Fallback auf Polling)
      const pollResult = await pollJobStatus(normalizedBase, apiKey, secretaryJobId)
      if (pollResult) return pollResult

      // Warten und erneut versuchen
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  throw new Error(`SSE-Stream für Job ${secretaryJobId} nach ${MAX_RETRIES} Versuchen fehlgeschlagen`)
}

/**
 * Liest den SSE-Stream und parst Events.
 * Schließt automatisch bei completed/error/timeout.
 */
async function readSSEStream(
  url: string,
  apiKey: string,
  secretaryJobId: string,
  onProgress?: ProgressCallback
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      signal: controller.signal,
    })

    if (!resp.ok) {
      throw new Error(`SSE-Stream HTTP ${resp.status}: ${resp.statusText}`)
    }

    if (!resp.body) {
      throw new Error('SSE-Stream: Response hat keinen Body')
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent: string | null = null

    FileLogger.info('secretary-sse', 'SSE-Stream geöffnet', { secretaryJobId, url })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Letzte (möglicherweise unvollständige) Zeile im Buffer behalten
      buffer = lines.pop() || ''

      for (const line of lines) {
        // Heartbeat-Kommentare ignorieren
        if (line.startsWith(':')) continue
        // Leere Zeile = Event-Ende (SSE-Spec)
        if (line.trim() === '') {
          currentEvent = null
          continue
        }

        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
          continue
        }

        if (line.startsWith('data: ') && currentEvent) {
          let eventData: SecretarySSEEvent['data']
          try {
            eventData = JSON.parse(line.slice(6))
          } catch {
            FileLogger.warn('secretary-sse', 'SSE-Data nicht parsbar', { line, secretaryJobId })
            continue
          }

          FileLogger.info('secretary-sse', `SSE-Event: ${currentEvent}`, {
            secretaryJobId,
            phase: eventData.phase,
            message: eventData.message,
            progress: eventData.data?.progress,
          })

          if (currentEvent === 'progress' && onProgress) {
            onProgress(eventData.data?.progress ?? 0, eventData.message || '')
          }

          if (currentEvent === 'completed') {
            reader.cancel()
            return (eventData.data?.results ?? eventData.data ?? {}) as Record<string, unknown>
          }

          if (currentEvent === 'error') {
            reader.cancel()
            const errMsg = eventData.error?.message || eventData.message || 'Unbekannter Fehler'
            throw new Error(`Secretary Job ${secretaryJobId} fehlgeschlagen: ${errMsg}`)
          }

          if (currentEvent === 'timeout') {
            reader.cancel()
            throw new Error(`Secretary SSE-Stream Timeout für Job ${secretaryJobId}`)
          }
        }
      }
    }

    throw new Error(`SSE-Stream für Job ${secretaryJobId} unerwartet geschlossen`)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Polling-Fallback: Prüft ob der Job bereits fertig ist.
 * Gibt die Ergebnisse zurück, falls completed; null wenn noch laufend.
 */
async function pollJobStatus(
  normalizedBase: string,
  apiKey: string,
  secretaryJobId: string
): Promise<Record<string, unknown> | null> {
  const statusUrl = normalizedBase.endsWith('/api')
    ? `${normalizedBase}/jobs/${secretaryJobId}`
    : `${normalizedBase}/api/jobs/${secretaryJobId}`

  try {
    const resp = await fetch(statusUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!resp.ok) return null

    const json = await resp.json() as {
      data?: {
        status?: string
        results?: Record<string, unknown>
        error?: { message?: string }
      }
    }
    const data = json.data

    if (data?.status === 'completed' && data.results) {
      FileLogger.info('secretary-sse', 'Job via Polling als completed erkannt', { secretaryJobId })
      return data.results
    }
    if (data?.status === 'failed') {
      throw new Error(`Secretary Job ${secretaryJobId} fehlgeschlagen: ${data.error?.message || 'Unbekannt'}`)
    }

    return null
  } catch (err) {
    if (err instanceof Error && err.message.includes('fehlgeschlagen')) throw err
    FileLogger.warn('secretary-sse', 'Polling-Fallback fehlgeschlagen', {
      secretaryJobId,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
