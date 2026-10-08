/**
 * @fileoverview MCP-Werkzeug `batch_bilanz` (Welle A).
 *
 * @description
 * Zaehler je Batch plus Fehler nach Ursache gruppiert (siehe
 * `batch-bilanz.ts`). Ohne batchId/batchName nennt die Antwort die bekannten
 * Batch-Namen der Library, statt still alles zu bilanzieren. Liest nur;
 * job_liste/job_status bleiben die Einzelansicht.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'
import { bilanziereJobs } from './batch-bilanz'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

/** Mehr Jobs je Batch liest die Bilanz nicht — der Rest steht im Job-Monitor. */
const MAX_JOBS = 500
const SEITE = 100

export async function ladeBatchJobs(
  repo: ExternalJobsRepository,
  userEmail: string,
  filter: { libraryId: string; batchId?: string; batchName?: string },
): Promise<{ jobs: ExternalJob[]; total: number }> {
  const jobs: ExternalJob[] = []
  let total = 0
  for (let page = 1; jobs.length < MAX_JOBS; page += 1) {
    const seite = await repo.listByUserWithFilters(userEmail, { ...filter, page, limit: SEITE })
    total = seite.total
    jobs.push(...seite.items)
    if (seite.items.length < SEITE || jobs.length >= total) break
  }
  return { jobs, total }
}

export function registerBatchBilanzTool(server: McpServer): void {
  server.registerTool(
    'batch_bilanz',
    {
      title: 'Bilanz eines Batches (Fehler nach Ursache)',
      description:
        'Zaehler eines Batches (queued/running/completed/failed) und die gescheiterten Jobs nach ' +
        'letzter Fehlerursache gruppiert — je Gruppe Meldung, Code, Schritt, Deutung, jobIds und ' +
        'betroffene Quellen. So laesst sich ein Neustart auf die Quellen beschraenken, bei denen er ' +
        'etwas bringt. Ohne batchId/batchName werden die Batch-Namen der Library genannt. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        batchId: z.string().min(1).optional().describe('batchId aus einer Stapel-Antwort (quelle_erschliessen, index_aktualisieren)'),
        batchName: z.string().min(1).optional().describe('ALTERNATIVE: Batch-Name aus dem Job-Monitor'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, batchId, batchName }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        if (batchId && batchName) throw new Error('Entweder batchId ODER batchName — nicht beides')
        const repo = new ExternalJobsRepository()
        if (!batchId && !batchName) {
          const namen = await repo.listDistinctBatchNames(userEmail, libraryId)
          return jsonResult({
            hinweis: 'batchId oder batchName angeben. Bekannte Batch-Namen dieser Library:',
            batchNamen: namen,
          })
        }
        const { jobs, total } = await ladeBatchJobs(repo, userEmail, { libraryId, batchId, batchName })
        const bilanz = bilanziereJobs(jobs)
        return jsonResult({
          batchId: batchId ?? null,
          batchName: batchName ?? null,
          ...(jobs.length < total ? { hinweis: `Nur ${jobs.length} von ${total} Jobs bilanziert (Obergrenze ${MAX_JOBS})` } : {}),
          ...bilanz,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
