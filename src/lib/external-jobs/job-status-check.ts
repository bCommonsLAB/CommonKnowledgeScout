/**
 * @fileoverview Job-Status-Prüfung für Startbarkeit
 *
 * @description
 * Prüft, ob ein Job gestartet werden kann. Berücksichtigt bereits gestartete Jobs,
 * fehlgeschlagene Jobs (können neu gestartet werden) und Timeout-Szenarien.
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import { FileLogger } from '@/lib/debug/logger'

export interface JobStartabilityResult {
  canStart: boolean
  reason?: string
}

/**
 * Prüft, ob ein Job gestartet werden kann.
 *
 * @param job Job-Dokument
 * @returns Ergebnis der Prüfung
 */
export function checkJobStartability(job: ExternalJob): JobStartabilityResult {
  // Erlaube Neustart, wenn Job fehlgeschlagen ist
  const isFailed = job.status === 'failed'
  if (isFailed) {
    return { canStart: true }
  }

  // Prüfe, ob Job bereits gestartet wurde
  const alreadyRequested = (() => {
    try {
      const jobWithTrace = job as ExternalJob & { trace?: { events?: Array<{ name?: unknown; ts?: unknown }> } };
      const evts = (jobWithTrace.trace?.events || []) as Array<{ name?: unknown; ts?: unknown }>
      if (!Array.isArray(evts)) return false

      const now = Date.now()
      const tenMinutesAgo = now - 600_000 // 10 Minuten in Millisekunden

      // Finde das neueste relevante Event
      const relevantEvents = evts.filter(e => {
        if (typeof e?.name !== 'string') return false
        return e.name === 'request_ack' || e.name === 'secretary_request_ack' || e.name === 'secretary_request_accepted'
      })

      if (relevantEvents.length === 0) return false

      // Prüfe, ob das neueste Event jünger als 10 Minuten ist
      const newestEvent = relevantEvents.reduce((latest, current) => {
        const currentTs = current.ts instanceof Date ? current.ts.getTime() : typeof current.ts === 'string' ? new Date(current.ts).getTime() : 0
        const latestTs = latest.ts instanceof Date ? latest.ts.getTime() : typeof latest.ts === 'string' ? new Date(latest.ts).getTime() : 0
        return currentTs > latestTs ? current : latest
      })

      const eventTs = newestEvent.ts instanceof Date ? newestEvent.ts.getTime() : typeof newestEvent.ts === 'string' ? new Date(newestEvent.ts).getTime() : 0

      // Wenn Event älter als 10 Minuten ist, erlaube Neustart
      if (eventTs < tenMinutesAgo) {
        FileLogger.info('job-status-check', 'request_ack Event ist älter als 10 Minuten - erlaube Neustart', {
          jobId: job.jobId,
          eventAgeMs: now - eventTs,
          eventAgeMinutes: Math.floor((now - eventTs) / 60000),
        })
        return false
      }

      return true
    } catch {
      return false
    }
  })()

  if (alreadyRequested) {
    return { canStart: false, reason: 'already_started' }
  }

  return { canStart: true }
}





