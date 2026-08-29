/**
 * @fileoverview `jobs_aufraeumen` — Karteileichen ueber die Bruecke wegraeumen.
 *
 * @description
 * Befund 29.08.2026 (Prod): Sechs Jobs hingen ab 19:08 in `running`, gaben ab
 * 19:13–19:18 kein Lebenszeichen mehr und belegten alle Worker-Slots;
 * neunzehn wartende Jobs standen still. Der eingebaute Reaper hat sie
 * aufgeraeumt — aber erst zwischen 19:43 und 19:48, dreissig Minuten nach dem
 * letzten Lebenszeichen. Ueber die Bruecke war bis dahin NICHTS zu machen:
 * `job_status` und `job_liste` lesen nur, und `DELETE /api/external/jobs/:id`
 * verweigert laufende Jobs ausdruecklich (409). Der Agent konnte zusehen.
 *
 * Dieses Werkzeug ist der Hand-Griff an denselben Hebel, den der Reaper
 * automatisch zieht — `reapStaleRunning`, gleiche DB-Operation, gleiches
 * Trace-Event `stale_running_reaped`. Kein zweiter Schreibpfad.
 *
 * Drei Grenzen, bewusst eng:
 * 1. NUR eigene Jobs (`userEmail`) und NUR die genannte Library.
 * 2. NUR Jobs ohne Lebenszeichen; die Schwelle ist einstellbar, aber nie
 *    unter `MIN_STILLSTAND_MINUTEN` — ein laufender Job soll nicht sterben,
 *    weil er gerade auf eine langsame LLM-Antwort wartet.
 * 3. `begruendung` ist Pflicht und landet im Aktions-Protokoll.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { baueErgebnisHinweis, holePoolSicht } from './job-pool-sicht'

/**
 * Untergrenze fuer die Stillstands-Schwelle. Unterhalb davon ist „steht still"
 * nicht mehr von „arbeitet gerade" zu unterscheiden: Transkription und
 * Template-Transformation laufen minutenlang ohne Zwischenstand.
 */
export const MIN_STILLSTAND_MINUTEN = 5

/** Obergrenze — darueber ist Warten ohnehin billiger als ein Werkzeugaufruf. */
export const MAX_STILLSTAND_MINUTEN = 240

/** Registriert `jobs_aufraeumen` (siehe Datei-Kommentar). */
export function registerJobAufraeumenTool(server: McpServer): void {
  server.registerTool(
    'jobs_aufraeumen',
    {
      title: 'Steckengebliebene Jobs wegraeumen (SCHREIBT)',
      description:
        'Setzt eigene Jobs dieser Library, die in „running" haengen und seit ' +
        'mindestStillstandMinuten kein Lebenszeichen mehr geben, auf „failed" — damit sie die ' +
        'Worker-Slots freigeben und die Warteschlange wieder laeuft. Derselbe Hebel, den der ' +
        'eingebaute Reaper automatisch zieht, nur sofort statt nach seiner Schwelle (die steht ' +
        'im pool-Block von job_liste). NUR anwenden, wenn job_liste zeigt, dass alle Slots belegt ' +
        'sind und Jobs ohne Lebenszeichen darunter sind — ein Job, der arbeitet, meldet ' +
        'minutenlang nichts (Transkription, LLM-Transformation) und wuerde hier unnoetig ' +
        'sterben. Betrifft NIE fremde Jobs oder andere Libraries. Aufgeraeumte Jobs sind ' +
        'gescheitert, nicht erledigt: neu starten mit quelle_erschliessen/transformation_starten. ' +
        'SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        mindestStillstandMinuten: z
          .number()
          .int()
          .min(MIN_STILLSTAND_MINUTEN)
          .max(MAX_STILLSTAND_MINUTEN)
          .optional()
          .describe(
            `Ab wie vielen Minuten ohne Lebenszeichen ein Job als Leiche gilt (${MIN_STILLSTAND_MINUTEN}-${MAX_STILLSTAND_MINUTEN}). ` +
              'Weglassen = Schwelle des eingebauten Reapers (stillstandSchwelleMinuten aus job_liste).',
          ),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, mindestStillstandMinuten, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'jobs_aufraeumen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)
            const { ExternalJobsWorker } = await import('@/lib/external-jobs-worker')
            const schwelleMs =
              mindestStillstandMinuten === undefined
                ? ExternalJobsWorker.getReaperMaxAgeMs()
                : mindestStillstandMinuten * 60_000

            const repo = new ExternalJobsRepository()
            const ergebnis = await repo.reapStaleRunning(schwelleMs, {
              workerId: 'mcp:jobs_aufraeumen',
              filter: { userEmail, libraryId },
              handAusgeloest: true,
            })
            const wartend = (
              await repo.listByUserWithFilters(userEmail, { libraryId, status: ['queued'], limit: 1 })
            ).total
            const poolSicht = await holePoolSicht(wartend)

            return jsonResult({
              libraryId,
              schwelleMinuten: Math.round(schwelleMs / 60_000),
              aufgeraeumt: ergebnis.reaped,
              jobs: ergebnis.details.map((job) => ({
                jobId: job.jobId,
                jobTyp: job.jobType,
                datei: job.fileName,
                letztesLebenszeichen: job.lastUpdatedAt,
                stillstandMinuten:
                  job.stillstandMs === null ? null : Math.round(job.stillstandMs / 60_000),
              })),
              wartend,
              ...poolSicht,
              hinweis: baueErgebnisHinweis(ergebnis.reaped, poolSicht.pool),
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

