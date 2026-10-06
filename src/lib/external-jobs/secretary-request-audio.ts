/**
 * @fileoverview Secretary-Request fuer Audio-Jobs (aus secretary-request.ts
 * ausgegliedert, P3a).
 *
 * @description
 * Zwei Endpunkte mit je eigenem Vertrag (Plan audio-namensraum-und-diarisierung):
 *
 * | Modus      | Endpunkt                  | prompt/keywords |
 * |------------|---------------------------|-----------------|
 * | normal     | `/audio/process`          | ja              |
 * | Sprecher   | `/audio/process-diarized` | nein (Anbieter) |
 *
 * Im Sprecher-Modus wird ein vorhandener Kontext NICHT gesendet — der Anbieter
 * nimmt ihn fuer dieses Modell nicht an. Das wird protokolliert (kein stiller
 * Fallback); der Kontext wirkt dann erst im Korrektur-Schritt (P3b).
 *
 * Template gehoert zur Transformations-Phase, nie in diesen Request
 * (siehe Begruendung in secretary-request.ts, Job ae632f5c 2026-04-30).
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import { FileLogger } from '@/lib/debug/logger'
import type { AudioJobContext } from './audio-context'

export interface AudioRequestArgs {
  job: ExternalJob
  file: File
  callbackUrl: string
  secret: string
  offline: boolean
  normalizedBaseUrl: string
  /** Aufgeloester Kontext (resolveAudioJobContext); fehlt er, geht nur Datei + Sprachen. */
  audioContext: AudioJobContext | undefined
}

export const AUDIO_ENDPOINT_NORMAL = '/audio/process'
export const AUDIO_ENDPOINT_DIARIZED = '/audio/process-diarized'

function endpointFor(normalizedBaseUrl: string, path: string): string {
  return normalizedBaseUrl.endsWith('/api') ? `${normalizedBaseUrl}${path}` : `${normalizedBaseUrl}/api${path}`
}

export function buildAudioSecretaryRequest(args: AudioRequestArgs): { url: string; formData: FormData } {
  const { job, file, callbackUrl, secret, offline, normalizedBaseUrl, audioContext } = args
  const opts = (job.correlation?.options || {}) as Record<string, unknown>

  const targetLanguage = typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de'
  const sourceLanguage = typeof opts['sourceLanguage'] === 'string' ? String(opts['sourceLanguage']) : 'auto'
  // Default: false – gecachte Fehler-Ergebnisse duerfen nicht stillschweigend wiederverwendet werden
  const useCache = typeof opts['useCache'] === 'boolean' ? opts['useCache'] : false

  const speakerMode = audioContext?.speakerMode === true
  const url = endpointFor(normalizedBaseUrl, speakerMode ? AUDIO_ENDPOINT_DIARIZED : AUDIO_ENDPOINT_NORMAL)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('target_language', targetLanguage)
  formData.append('source_language', sourceLanguage)
  // Secretary uses `useCache` (see existing Next proxy routes)
  formData.append('useCache', String(useCache))

  const prompt = audioContext?.prompt
  const keywords = audioContext?.keywords ?? []
  const hasContext = Boolean(prompt) || keywords.length > 0
  let contextSent = false
  if (!audioContext) {
    FileLogger.warn('secretary-request', 'Audio ohne aufgeloesten Kontext — nur Datei und Sprachen gehen an den Secretary', {
      jobId: job.jobId,
    })
  } else if (speakerMode) {
    if (hasContext) {
      FileLogger.warn('secretary-request', 'Sprecher-Modus: Kontext wird nicht gesendet (Anbieter nimmt fuer dieses Modell keinen Prompt an)', {
        jobId: job.jobId,
        droppedPrompt: Boolean(prompt),
        droppedKeywords: keywords.length,
      })
    }
  } else {
    if (prompt) formData.append('prompt', prompt)
    // JSON-Liste statt Kommaliste: Namen mit Komma bleiben ein Begriff.
    if (keywords.length > 0) formData.append('keywords', JSON.stringify(keywords))
    contextSent = hasContext
  }

  // Im Offline-Modus (Electron): callback_url weglassen → Secretary antwortet synchron
  if (!offline) {
    formData.append('callback_url', callbackUrl)
    formData.append('callback_token', secret)
  }

  FileLogger.info('secretary-request', 'Audio FormData erstellt', {
    jobId: job.jobId,
    url,
    fileName: file.name,
    fileSize: file.size,
    targetLanguage,
    sourceLanguage,
    useCache: String(useCache),
    speakerMode,
    speakerModeSource: audioContext?.speakerModeSource ?? 'unresolved',
    contextSent,
    keywordCount: keywords.length,
    callbackUrl: offline ? '(offline-mode)' : callbackUrl,
  })

  return { url, formData }
}
