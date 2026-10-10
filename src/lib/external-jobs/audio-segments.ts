/**
 * @fileoverview Satz-Segmente eines abgeschlossenen Audio-Jobs speichern.
 *
 * @description
 * Wird im Callback bei `phase: completed` fuer Audio/Video aufgerufen, bevor
 * die Phasen verzweigen (Extract-only oder mit Template). Die Segmente sind eine
 * Messung des Laufs, kein Artefakt: Schlaegt das Speichern fehl, scheitert der
 * Job NICHT — der Fehler steht laut im Job-Trace und im Log, und das Transkript
 * gilt dann als „ohne Verlaesslichkeitswerte".
 *
 * Liefert der Secretary keine Segmente (alter Stand, Sprecher-Weg ohne Werte),
 * wird trotzdem gespeichert — mit leerer Liste bzw. `null`-Werten —, damit kein
 * Ergebnis eines frueheren Laufs neben dem neuen Transkript stehen bleibt.
 *
 * @module external-jobs
 */

import { FileLogger } from '@/lib/debug/logger'
import { saveTranscriptSegments } from '@/lib/repositories/transcript-segments-repo'
import { readTranscriptSegments } from '@/lib/transkript-verlaesslichkeit/segmente'
import type { ExternalJob } from '@/types/external-job'

export interface AudioSegmentsLog {
  phase: string
  message: string
  [key: string]: unknown
}

export interface PersistAudioSegmentsResult {
  gespeichert: boolean
  anzahl: number
  mitWerten: number
}

export async function persistAudioSegments(args: {
  job: ExternalJob
  callbackBody: unknown
  log: (eintrag: AudioSegmentsLog) => void
}): Promise<PersistAudioSegmentsResult> {
  const { job, callbackBody, log } = args
  const sourceId = job.correlation?.source?.itemId
  if (!sourceId) {
    log({ phase: 'transcript_segments_skipped', message: 'Segmente nicht gespeichert: Job ohne source.itemId' })
    return { gespeichert: false, anzahl: 0, mitWerten: 0 }
  }
  // Nur Information am Dokument; der Schluessel ist die Quelle (wie der Transkript-Record).
  const targetLanguage = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const gelesen = readTranscriptSegments(callbackBody)
  const mitWerten = gelesen.segments.filter((s) => s.avgLogprob !== null || s.minLogprob !== null).length
  try {
    await saveTranscriptSegments({
      libraryId: job.libraryId,
      sourceId,
      targetLanguage,
      jobId: job.jobId,
      llmModel: gelesen.llmModel,
      dataLanguage: gelesen.dataLanguage,
      segments: gelesen.segments,
      translatedChunks: gelesen.translatedChunks,
    })
    log({
      phase: 'transcript_segments_saved',
      message: mitWerten > 0
        ? `${gelesen.segments.length} Segmente gespeichert, ${mitWerten} mit Verlaesslichkeitswerten`
        : `${gelesen.segments.length} Segmente gespeichert, keine Verlaesslichkeitswerte geliefert`,
      anzahl: gelesen.segments.length,
      mitWerten,
      verworfen: gelesen.verworfen,
      dataLanguage: gelesen.dataLanguage,
      // null = aelterer Secretary ohne das Feld; eine Liste mit Eintraegen widerspricht translate=false.
      uebersetzteStuecke: gelesen.translatedChunks === null ? 'unbekannt' : gelesen.translatedChunks.length,
    })
    return { gespeichert: true, anzahl: gelesen.segments.length, mitWerten }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    FileLogger.error('audio-segments', 'Segmente nicht gespeichert', { jobId: job.jobId, sourceId, error: message })
    log({ phase: 'transcript_segments_failed', message: `Segmente nicht gespeichert: ${message}` })
    return { gespeichert: false, anzahl: gelesen.segments.length, mitWerten }
  }
}
