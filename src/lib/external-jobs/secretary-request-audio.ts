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
 * `languages` (moegliche Sprachen der Aufnahme) geht im normalen Weg als
 * JSON-Liste mit; ohne sie entscheidet das Modell je Stueck selbst und
 * uebersetzt gemischte Rede (Prueffall 09.10.2026).
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
  // process-diarized kennt weder target_language noch template (Dienst-Doku audio.md).
  if (!speakerMode) formData.append('target_language', targetLanguage)
  // Das Transkript bildet das Original ab — Uebersetzen gehoert zur Transformation
  // (Owner 10.10.2026). Der Secretary wertet das Feld ab Auftrag F aus; bis dahin
  // schuetzt nur `languages` gemischte Stuecke vor der Uebersetzung.
  if (!speakerMode) formData.append('translate', 'false')
  formData.append('source_language', sourceLanguage)
  // Secretary uses `useCache` (see existing Next proxy routes)
  formData.append('useCache', String(useCache))

  const prompt = audioContext?.prompt
  const keywords = audioContext?.keywords ?? []
  const languages = audioContext?.languages ?? []
  const hasContext = Boolean(prompt) || keywords.length > 0 || languages.length > 0
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
        droppedLanguages: languages,
      })
    }
  } else {
    if (prompt) formData.append('prompt', prompt)
    // JSON-Liste statt Kommaliste: Namen mit Komma bleiben ein Begriff.
    if (keywords.length > 0) formData.append('keywords', JSON.stringify(keywords))
    if (languages.length > 0) formData.append('languages', JSON.stringify(languages))
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
    languages,
    languagesSource: audioContext?.languagesSource ?? 'unresolved',
    callbackUrl: offline ? '(offline-mode)' : callbackUrl,
  })

  return { url, formData }
}
