/**
 * @fileoverview MCP-Werkzeuge fuer Job-Beobachtung (Welle 5, Pilot-Wunschliste C2).
 *
 * @description
 * `job_status` (ein Job, mit Fortschritt aus job.logs + Schritten) und
 * `job_liste` (offene Jobs einer Library — die „was laeuft noch?“-Sicht nach
 * einem Sessionabbruch). Aus `tools-erschliessen.ts` ausgelagert
 * (200-Zeilen-Regel). Beide lesen nur.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'
import { fehlerDetailsAusTrace } from './job-fehler-details'

/**
 * Fehlerdetails eines gescheiterten Jobs — oder die ehrliche Auskunft,
 * dass der Trace nichts hergibt (alte Jobs ohne Trace).
 */
function fehlerBlock(job: unknown): Record<string, unknown> {
  const details = fehlerDetailsAusTrace(job)
  if (details.length === 0) {
    return {
      fehlerDetails: [],
      fehlerHinweis:
        'Der Job ist gescheitert, sein Trace enthaelt aber keine Fehlerereignisse — ' +
        'entweder ein alter Job ohne Trace oder der Fehlschlag lag ausserhalb der Schritte.',
    }
  }
  return { fehlerDetails: details }
}

/** Registriert job_status + job_liste (siehe Datei-Kommentar). */
export function registerJobTools(server: McpServer): void {
  server.registerTool(
    'job_status',
    {
      title: 'Job-Status',
      description:
        'Status eines mit quelle_erschliessen/transformation_starten gestarteten Jobs: ' +
        'queued/running/completed/failed plus letzte Meldung. Bei einem GESCHEITERTEN Job ' +
        'kommen die Fehlerdetails aus dem Job-Trace automatisch mit (fehlerDetails): welcher ' +
        'Schritt, welcher Code, die eigentliche Meldung des Dienstes, HTTP-Status und ein ' +
        'Auszug der Antwort. Damit ist ein Fehlschlag OHNE Blick in die Datenbank zu ' +
        'analysieren. Liest nur.',
      inputSchema: { jobId: z.string().min(1).describe('jobId aus der Start-Antwort') },
      annotations: { readOnlyHint: true },
    },
    async ({ jobId }) => {
      try {
        mcpUserEmail()
        const job = await new ExternalJobsRepository().get(jobId)
        if (!job) return jsonResult({ jobId, status: 'unbekannt', hinweis: 'Kein Job mit dieser Id gefunden' })
        // Pilot-Wunschliste C2: Fortschritt/Meldung leben in job.logs (der
        // Worker schreibt phase/progress/message nach Mongo) und in job.steps
        // — die frueheren Flat-Felder gab es nie (durchgaengig null).
        const lastLog = job.logs?.length ? job.logs[job.logs.length - 1] : null
        return jsonResult({
          jobId,
          status: job.status,
          jobTyp: job.job_type,
          datei: job.correlation?.source?.name ?? null,
          fortschritt: lastLog?.progress ?? null,
          phase: lastLog?.phase ?? null,
          meldung: lastLog?.message ?? null,
          schritte: (job.steps ?? []).map((step) => ({
            name: step.name,
            status: step.status,
            ...(step.durationMs !== undefined ? { dauerMs: step.durationMs } : {}),
          })),
          fehler: job.error?.message ?? null,
          // Welle ST7: Bei einem Fehlschlag ist `job.error.message` der Satz,
          // der das Scheitern benennt („Template-Transformation
          // fehlgeschlagen") — erklaeren tut er nichts. Das WARUM steht im
          // Trace und kam bisher nie heraus; genau dafuer musste jemand in
          // die Datenbank. Ungefragt mitgeliefert, weil man sonst wissen
          // muesste, dass man fragen kann.
          ...(job.status === 'failed' ? fehlerBlock(job) : {}),
          erstellt: job.createdAt ?? null,
          aktualisiert: job.updatedAt ?? null,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'job_liste',
    {
      title: 'Offene Jobs einer Library',
      description:
        'Listet Jobs einer Library (Default: nur queued/running — die „was laeuft noch?“-Sicht ' +
        'nach einem Sessionabbruch, wenn jobIds verloren sind). Mit status auch abgeschlossene. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        status: z.enum(['queued', 'running', 'completed', 'failed']).optional()
          .describe('Nur dieser Status; ohne Angabe queued + running'),
        maxJobs: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, status, maxJobs }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const { items, total } = await new ExternalJobsRepository().listByUserWithFilters(userEmail, {
          libraryId,
          status: status ?? ['queued', 'running'],
          limit: maxJobs ?? 20,
        })
        return jsonResult({
          libraryId,
          statusFilter: status ?? 'queued+running',
          jobAnzahl: total,
          gekappt: items.length < total,
          jobs: items.map((job) => ({
            jobId: job.jobId,
            status: job.status,
            jobTyp: job.job_type,
            datei: job.correlation?.source?.name ?? null,
            fortschritt: job.logs?.length ? job.logs[job.logs.length - 1]?.progress ?? null : null,
            erstellt: job.createdAt ?? null,
            aktualisiert: job.updatedAt ?? null,
          })),
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
