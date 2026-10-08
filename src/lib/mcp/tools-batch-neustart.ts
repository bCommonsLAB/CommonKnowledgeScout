/**
 * @fileoverview MCP-Werkzeug `batch_neustart` (Welle C).
 *
 * @description
 * Der Knopf im Job-Monitor (`start-batch`): Jobs eines Batches nach Status
 * neu starten, laufende auslassen. Die Bruecke stellt die Jobs zurueck in
 * die Warteschlange (`requeueForRestart`) und stoesst den Worker an — derselbe
 * Weg, den der Worker fuer jeden neuen Job geht. Gedacht NACH batch_bilanz:
 * nur dort neu starten, wo die Ursache behoben ist (jobIds aus der Gruppe).
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { ladeBatchJobs } from './tools-batch-bilanz'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

const MAX_JOBIDS = 100

export function registerBatchNeustartTool(server: McpServer): void {
  server.registerTool(
    'batch_neustart',
    {
      title: 'Jobs eines Batches neu starten (SCHREIBT)',
      description:
        'Stellt gescheiterte Jobs eines Batches (batchId/batchName, Default status failed) oder eine ' +
        'Liste jobIds (aus batch_bilanz) zurueck in die Warteschlange und stoesst den Worker an — wie ' +
        'der Neustart-Knopf im Job-Monitor. Laufende Jobs werden uebersprungen. Vorher batch_bilanz: ' +
        'ein Neustart bringt nur dort etwas, wo die Ursache behoben ist (z. B. Transkript nachgeholt). ' +
        'SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        batchId: z.string().min(1).optional(),
        batchName: z.string().min(1).optional(),
        jobIds: z.array(z.string().min(1)).min(1).max(MAX_JOBIDS).optional().describe('ALTERNATIVE: genau diese Jobs (z. B. eine Ursachen-Gruppe aus batch_bilanz)'),
        status: z.enum(['failed', 'queued', 'completed']).optional().describe('Nur Jobs mit diesem Status (Default failed); gilt nicht mit jobIds'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, batchId, batchName, jobIds, status, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'batch_neustart', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          const userEmail = mcpUserEmail()
          await requireLibrary(userEmail, libraryId)
          const ueberJobIds = Array.isArray(jobIds) && jobIds.length > 0
          const ueberBatch = Boolean(batchId) || Boolean(batchName)
          if (ueberJobIds && ueberBatch) throw new Error('Entweder jobIds ODER batchId/batchName — nicht beides')
          if (!ueberJobIds && !ueberBatch) throw new Error('jobIds oder batchId/batchName ist Pflicht')
          if (batchId && batchName) throw new Error('Entweder batchId ODER batchName — nicht beides')

          const repo = new ExternalJobsRepository()
          const kandidaten: Array<{ jobId: string; status: string; libraryId: string; userEmail: string }> = []
          if (ueberJobIds) {
            for (const jobId of jobIds ?? []) {
              const job = await repo.get(jobId)
              if (!job) { kandidaten.push({ jobId, status: 'unbekannt', libraryId: '', userEmail: '' }); continue }
              kandidaten.push({ jobId, status: job.status, libraryId: job.libraryId, userEmail: job.userEmail })
            }
          } else {
            const { jobs } = await ladeBatchJobs(repo, userEmail, { libraryId, batchId, batchName })
            const gewuenscht = status ?? 'failed'
            kandidaten.push(...jobs.filter((j) => j.status === gewuenscht).map((j) => ({ jobId: j.jobId, status: j.status, libraryId: j.libraryId, userEmail: j.userEmail })))
          }

          const neuGestartet: string[] = []
          const uebersprungen: Array<{ jobId: string; grund: string }> = []
          for (const k of kandidaten) {
            if (k.status === 'unbekannt') { uebersprungen.push({ jobId: k.jobId, grund: 'kein Job mit dieser Id' }); continue }
            if (k.libraryId !== libraryId || k.userEmail !== userEmail) { uebersprungen.push({ jobId: k.jobId, grund: 'gehoert nicht zu dieser Library/diesem Konto' }); continue }
            if (k.status === 'running') { uebersprungen.push({ jobId: k.jobId, grund: 'laeuft — nicht angefasst (jobs_aufraeumen fuer Leichen)' }); continue }
            if (await repo.requeueForRestart(k.jobId)) neuGestartet.push(k.jobId)
            else uebersprungen.push({ jobId: k.jobId, grund: 'Status hat sich inzwischen geaendert' })
          }
          if (neuGestartet.length > 0) {
            // Sofortiger Tick statt Warten auf das Intervall — wie der Worker-Trigger der Pipeline-Route.
            const { ExternalJobsWorker } = await import('@/lib/external-jobs-worker')
            await ExternalJobsWorker.tickNow()
          }
          return jsonResult({
            neuGestartet: neuGestartet.length,
            uebersprungen: uebersprungen.length,
            jobIds: neuGestartet,
            uebersprungeneJobs: uebersprungen,
            hinweis: neuGestartet.length > 0 ? 'Jobs stehen wieder in der Warteschlange; Bilanz mit batch_bilanz, Einzelstand mit job_status.' : 'Nichts neu gestartet.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
