/**
 * @fileoverview `job_abbrechen` — einen bestimmten Job beenden (Welle W7).
 *
 * @description
 * Cowork-Befund 02.09.2026: Ein Job steht seit dem 29.08. auf `running`.
 * `jobs_aufraeumen` raeumt ihn nicht ab, und das ist richtig so — dieses
 * Werkzeug beantwortet eine andere Frage. `jobs_aufraeumen` fragt „steht
 * etwas still?" und zieht denselben Hebel wie der Reaper, auf einer Menge
 * von Jobs, anhand einer Stillstands-Schwelle. Hier fragt der Mensch: „diesen
 * einen will ich nicht mehr."
 *
 * Deshalb KEINE Schwelle: Ein Job, der brav Lebenszeichen gibt, ist ein
 * legitimes Ziel — wer eine falsche Vorlage gestartet hat, will nicht 30
 * Minuten warten, bis sie fertig danebenliegt. Was bleibt, sind die Grenzen,
 * die auch der Reap-Griff hat:
 *
 * 1. NUR eigene Jobs (`userEmail`) und NUR die genannte Library.
 * 2. NUR was noch laufen kann (`queued`/`running`) — ein fertiger Job wird
 *    nicht nachtraeglich umgeschrieben.
 * 3. `begruendung` ist Pflicht und landet im Aktions-Protokoll.
 *
 * Der Status wird `failed`, nicht `completed`: Abgebrochen heisst nicht
 * erledigt. Ein `completed` ohne Ergebnis waere dieselbe Luege, die W9
 * abstellt.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'

/** Zustaende, aus denen ein Abbruch ueberhaupt etwas bewirkt. */
const ABBRECHBAR = new Set(['queued', 'running'])

/** Registriert `job_abbrechen` (siehe Datei-Kommentar). */
export function registerJobAbbrechenTool(server: McpServer): void {
  server.registerTool(
    'job_abbrechen',
    {
      title: 'Einen bestimmten Job beenden (SCHREIBT)',
      description:
        'Setzt EINEN eigenen Job dieser Library auf „failed" und gibt seinen Slot frei — ' +
        'unabhaengig davon, ob er noch Lebenszeichen gibt. Fuer „diesen einen will ich nicht ' +
        'mehr" (falsche Vorlage, falsche Quelle, Job aus einer alten Sitzung). Nicht zu ' +
        'verwechseln mit jobs_aufraeumen: Das raeumt MEHRERE Jobs weg, aber nur solche ohne ' +
        'Lebenszeichen ueber einer Schwelle. Betrifft NIE fremde Jobs oder andere Libraries; ' +
        'bereits beendete Jobs werden nicht angefasst. Abgebrochen heisst GESCHEITERT, nicht ' +
        'erledigt — was gebraucht wird, neu starten. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        jobId: z.string().min(1).describe('jobId aus job_liste/job_status'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, jobId, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'job_abbrechen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            const userEmail = mcpUserEmail()
            await requireLibrary(userEmail, libraryId)

            const repo = new ExternalJobsRepository()
            const job = await repo.get(jobId)
            // „Gibt es nicht" und „gehoert dir nicht" werden bewusst GLEICH
            // beantwortet: Sonst waere das Werkzeug eine Auskunft darueber,
            // welche fremden jobIds existieren.
            if (!job || job.userEmail !== userEmail || job.libraryId !== libraryId) {
              throw new Error(
                `Kein eigener Job "${jobId}" in dieser Library — nichts geaendert. ` +
                'jobId aus job_liste dieser Library verwenden.',
              )
            }
            if (!ABBRECHBAR.has(job.status)) {
              return jsonResult({
                jobId, abgebrochen: false, status: job.status,
                hinweis: `Job steht auf "${job.status}" und laeuft nicht mehr — nichts geaendert.`,
              })
            }

            const vorherigerStatus = job.status
            const erfolg = await repo.setStatusIf(jobId, vorherigerStatus, 'failed', {
              error: {
                code: 'von_hand_abgebrochen',
                message:
                  `Von Hand abgebrochen ueber die MCP-Bruecke (${userEmail}): ${begruendung}`,
                details: { vorherigerStatus, werkzeug: 'job_abbrechen' },
              },
            })
            if (!erfolg) {
              // Zwischen Lesen und Schreiben hat der Worker den Job bewegt.
              const jetzt = await repo.get(jobId)
              return jsonResult({
                jobId, abgebrochen: false, status: jetzt?.status ?? 'unbekannt',
                hinweis:
                  'Der Job hat seinen Zustand zwischen Lesen und Schreiben geaendert — nichts ' +
                  'ueberschrieben. job_status neu lesen und bei Bedarf erneut abbrechen.',
              })
            }

            return jsonResult({
              jobId,
              abgebrochen: true,
              vorherigerStatus,
              status: 'failed',
              datei: job.correlation?.source?.name ?? null,
              hinweis:
                'Slot ist frei. Der Job ist GESCHEITERT, nicht erledigt — was gebraucht wird, ' +
                'mit quelle_erschliessen/transformation_starten neu starten.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
