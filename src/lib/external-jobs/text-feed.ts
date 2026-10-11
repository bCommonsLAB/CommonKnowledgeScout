/**
 * @fileoverview Text-Feed der Bruecke: Callback-Route fuettern, ehrlich bilanzieren (Welle I2).
 *
 * @description
 * `enqueueTemplateOnTextJob` legt den Job an und fuettert die Callback-Route
 * mit dem Transkript; die Route rechnet dabei den GANZEN Job (LLM,
 * Einbettungen, Spiegel-Writes) und antwortet erst danach. Bewusst nicht
 * awaited (Befund 27.08.2026, 60-Sekunden-Grenze der Bruecke).
 *
 * Befund 11.10.2026: Der Feed setzte bei JEDEM Fehler bedingungslos
 * `failed` — auch ueber einen Job, dessen Transformation und Ingest fertig
 * waren, weil das globale `fetch` nach 300 s „fetch failed" meldete, waehrend
 * die Route weiterrechnete. Seither:
 *
 * - Zeitgrenze oberhalb von `EXTERNAL_TEMPLATE_TIMEOUT_MS` plus Ingest-Zugabe;
 *   ihr Ablauf ist ein Trace-Ereignis `text_feed_timeout` mit Deutung, kein
 *   Status.
 * - `failed` nur, wenn die Route den Job nie angefasst hat
 *   (`setFailedIfUntouched`, Filter in `job-unberuehrt-filter.ts`). Hat sie
 *   gearbeitet, bleibt der Endstatus bei ihr; der Feed-Fehler steht im Trace.
 * - Der Job ist waehrend des Feeds nicht vom Worker claimbar
 *   (`buildTemplateOnTextJob` legt ihn als `running` an).
 *
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { FileLogger } from '@/lib/debug/logger'
import { getSelfBaseUrl } from '@/lib/env'
import { sendeTextFeed, TextFeedZeitablauf, type TextFeedAntwort } from './text-feed-transport'

/** Zugabe fuer Einbettungen und Spiegel-Writes nach der Transformation. */
export const TEXT_FEED_INGEST_ZUGABE_MS = 10 * 60 * 1000

/** Zeitgrenze des Feeds: Template-Grenze der Route plus Ingest-Zugabe. */
export function textFeedZeitgrenzeMs(env: NodeJS.ProcessEnv = process.env): number {
  const template = Number(env.EXTERNAL_TEMPLATE_TIMEOUT_MS || env.EXTERNAL_REQUEST_TIMEOUT_MS || 600000)
  return template + TEXT_FEED_INGEST_ZUGABE_MS
}

export type FeedAusgang =
  | { art: 'zugestellt' }
  | { art: 'http'; status: number; text: string }
  | { art: 'netz'; meldung: string }
  | { art: 'zeitablauf'; zeitgrenzeMs: number }

/** Nur die Repository-Methoden, die der Feed braucht (unit-testbar). */
export type TextFeedRepo = Pick<ExternalJobsRepository, 'setFailedIfUntouched' | 'traceAddEvent'>

export function deuteZeitablauf(zeitgrenzeMs: number): string {
  return (
    `Der Text-Feed hat nach ${Math.round(zeitgrenzeMs / 1000)} s keine Antwort bekommen. Die Callback-Route ` +
    'rechnet synchron und antwortet erst nach Transformation und Ingest — der Job laeuft wahrscheinlich noch ' +
    '(job_status). Endet er auf completed, war nur der Feed zu ungeduldig; bleibt er auf running, ist die ' +
    'Route abgebrochen (Reaper oder jobs_aufraeumen).'
  )
}

function fehlerMeldung(ausgang: Exclude<FeedAusgang, { art: 'zugestellt' | 'zeitablauf' }>): string {
  return ausgang.art === 'http'
    ? `Text-Feed schlug fehl (HTTP ${ausgang.status}): ${ausgang.text.slice(0, 500)}`
    : `Text-Feed nicht zustellbar: ${ausgang.meldung}`
}

/**
 * Bilanziert den Ausgang des Feeds am Job. Liefert zurueck, was passiert ist,
 * damit Tests und Logs es benennen koennen.
 */
export async function verbucheFeedAusgang(
  repo: TextFeedRepo,
  jobId: string,
  ausgang: FeedAusgang,
): Promise<'nichts' | 'failed' | 'ereignis'> {
  if (ausgang.art === 'zugestellt') return 'nichts'
  if (ausgang.art === 'zeitablauf') {
    FileLogger.warn('text-feed', 'Text-Feed: Zeitgrenze abgelaufen, Status bleibt bei der Route', { jobId, zeitgrenzeMs: ausgang.zeitgrenzeMs })
    await repo.traceAddEvent(jobId, {
      spanId: 'job', name: 'text_feed_timeout', level: 'warn',
      message: deuteZeitablauf(ausgang.zeitgrenzeMs), attributes: { zeitgrenzeMs: ausgang.zeitgrenzeMs },
    })
    return 'ereignis'
  }
  const meldung = fehlerMeldung(ausgang)
  FileLogger.error('text-feed', 'Text-Feed fehlgeschlagen', { jobId, meldung })
  const gesetzt = await repo.setFailedIfUntouched(jobId, { code: 'text_feed_failed', message: meldung })
  if (gesetzt) return 'failed'
  await repo.traceAddEvent(jobId, {
    spanId: 'job', name: 'text_feed_fehler_nach_arbeit', level: 'warn',
    message: `${meldung} — die Route hatte den Job schon in Arbeit; ihr Endstatus gilt, nicht dieser Feed-Fehler.`,
  })
  return 'ereignis'
}

/** Fuettert die Callback-Route; der Aufrufer wartet NICHT darauf. */
export async function fuettereTextImHintergrund(args: {
  jobId: string
  jobSecret: string
  extractedText: string
  transport?: typeof sendeTextFeed
  repo?: TextFeedRepo
}): Promise<'nichts' | 'failed' | 'ereignis'> {
  const transport = args.transport ?? sendeTextFeed
  const repo = args.repo ?? new ExternalJobsRepository()
  const zeitgrenzeMs = textFeedZeitgrenzeMs()
  let ausgang: FeedAusgang
  try {
    const antwort: TextFeedAntwort = await transport({
      url: `${getSelfBaseUrl().replace(/\/$/, '')}/api/external/jobs/${args.jobId}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.jobSecret}`,
        'X-Internal-Token': process.env.INTERNAL_TEST_TOKEN || '',
      },
      body: JSON.stringify({ data: { extracted_text: args.extractedText } }),
      zeitgrenzeMs,
    })
    ausgang = antwort.ok ? { art: 'zugestellt' } : { art: 'http', status: antwort.status, text: antwort.text }
  } catch (fehler) {
    ausgang = fehler instanceof TextFeedZeitablauf
      ? { art: 'zeitablauf', zeitgrenzeMs: fehler.zeitgrenzeMs }
      : { art: 'netz', meldung: fehler instanceof Error ? fehler.message : String(fehler) }
  }
  try {
    return await verbucheFeedAusgang(repo, args.jobId, ausgang)
  } catch (fehler) {
    FileLogger.error('text-feed', 'Feed-Ausgang liess sich nicht am Job verbuchen', {
      jobId: args.jobId, fehler: fehler instanceof Error ? fehler.message : String(fehler),
    })
    return 'nichts'
  }
}
