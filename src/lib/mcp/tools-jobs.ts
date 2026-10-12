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
import { befundeFuerJob } from './job-befunde'
import { ereignisseAusTrace } from './job-ereignisse'
import { fehlerBlock } from './job-fehler-details'
import { zaehleKuerzlichGescheitert } from './job-liste-ehrlich'
import { beschreibeSchritte, uebersprungenHinweis } from './job-schritte'
import { holePoolSicht } from './job-pool-sicht'
import { audioKontextVonJob } from './job-audio-kontext'

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
        'Auszug der Antwort. Erkennt die Bruecke eine bekannte Lage, kommt `fehlerDeutung` mit ' +
        '(Klartext + Empfehlung + ob ein zweiter Versuch ueberhaupt Sinn hat) — etwa eine Quelle ' +
        'ohne Tonspur, bei der jeder Neustart dieselbe Wand trifft. UEBERSPRUNGENE Schritte sind je Schritt markiert (uebersprungen/' +
        'grund); hat ein completed-Job ALLE Schritte uebersprungen, sagt ein Hinweis explizit, ' +
        'dass NICHTS geschrieben wurde. Welle K: `ereignisse` nennt die Trace-Ereignisse der Lesersicht ' +
        '(slide_images_resolved/unresolved, cover_source, attachments_source, attachments_links_rewritten, ' +
        'extract_only_page_images_*, frontmatter_json_list_invalid) mit Attributen, und `befunde` sagt in ' +
        'Klartext, was dem Leser fehlt (Folien ohne Adresse, Cover ohne Quelle, keine PDF-Anhaenge, ' +
        'Transformation uebersprungen) — leere Liste heisst: nichts zu melden, auch bei completed. Damit ' +
        'ist ein Fehlschlag OHNE Blick in die Datenbank zu analysieren. Liest nur.',
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
        // Welle K2/K3: Die Ereignisse der Lesersicht standen bisher nur im
        // Fehlerfall da; ein Ingest mit 0 von 58 Bildern war ein stummes completed.
        const ereignisse = ereignisseAusTrace(job)
        const befunde = befundeFuerJob({ status: job.status, steps: job.steps, ereignisse })
        return jsonResult({
          jobId,
          status: job.status,
          jobTyp: job.job_type,
          datei: job.correlation?.source?.name ?? null,
          fortschritt: lastLog?.progress ?? null,
          phase: lastLog?.phase ?? null,
          meldung: lastLog?.message ?? null,
          // Welle ST11: Skips bleiben sichtbar (Befund 29.08.2026 — ein
          // komplett uebersprungener Job sah aus wie einer, der gearbeitet
          // hat; die Wahrheit lag in step.details und wurde hier verworfen).
          schritte: beschreibeSchritte(job.steps),
          ...(() => {
            const hinweis = uebersprungenHinweis({ status: job.status, steps: job.steps })
            return hinweis ? { nichtsGeschrieben: hinweis } : {}
          })(),
          befunde,
          ereignisse,
          fehler: job.error?.message ?? null,
          // Welle ST7: Bei einem Fehlschlag ist `job.error.message` der Satz,
          // der das Scheitern benennt („Template-Transformation
          // fehlgeschlagen") — erklaeren tut er nichts. Das WARUM steht im
          // Trace und kam bisher nie heraus; genau dafuer musste jemand in
          // die Datenbank. Ungefragt mitgeliefert, weil man sonst wissen
          // muesste, dass man fragen kann.
          ...(job.status === 'failed' ? fehlerBlock(job) : {}),
          // Welle B: bei Audio-Jobs die Transkriptions-Optionen, wie sie im Job liegen (Weg sichtbar).
          ...(job.job_type === 'audio' ? { audioKontext: audioKontextVonJob(job) } : {}),
          // Welle F: in-process-Phasen (Golden-Set) legen ihr Ergebnis an den Job.
          ...(job.cumulativeMeta?.goldenSet ? { ergebnis: job.cumulativeMeta.goldenSet } : {}),
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
        'nach einem Sessionabbruch, wenn jobIds verloren sind). Ohne status-Filter nennt die ' +
        'Antwort zusaetzlich die Fehlschlaege der letzten Stunde (gescheitertKuerzlich) — eine ' +
        'leere Liste heisst NICHT, dass alles gut ging. Mit status auch abgeschlossene. ' +
        'Der Block `pool` sagt, WARUM eine Warteschlange stillsteht: Worker-Slots insgesamt, ' +
        'belegte und steckengebliebene POOL-WEIT (alle Libraries, alle User) — die Concurrency-' +
        'Grenze gilt global, die Liste daneben nur fuer diese Library. Sind alle Slots von Jobs ' +
        'ohne Lebenszeichen belegt, wartet man nicht auf Arbeit, sondern auf Karteileichen ' +
        '(wegraeumen: jobs_aufraeumen). Liest nur.',
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
        const repo = new ExternalJobsRepository()
        const { items, total } = await repo.listByUserWithFilters(userEmail, {
          libraryId,
          status: status ?? ['queued', 'running'],
          limit: maxJobs ?? 20,
        })
        // ST9 (Praxisbilanz 28.08.2026): Ohne Filter meldete die Liste Ruhe,
        // waehrend 14 von 15 Jobs gescheitert waren — wer auf seinen Stapel
        // wartet, liest Ruhe als Erfolg. Die Fehlschlaege der letzten Stunde
        // gehoeren deshalb ungefragt in die Antwort.
        const gescheitertKuerzlich = status === undefined
          ? zaehleKuerzlichGescheitert(
              (await repo.listByUserWithFilters(userEmail, { libraryId, status: ['failed'], limit: 100 })).items,
            )
          : null
        // Befund 29.08.2026: Sechs Karteileichen belegten alle Worker-Slots, 19
        // eigene Jobs standen dahinter — ueber die Bruecke war der Grund
        // unsichtbar. Die Warteschlange braucht ihre Erklaerung daneben.
        const wartend = (
          await repo.listByUserWithFilters(userEmail, { libraryId, status: ['queued'], limit: 1 })
        ).total
        const poolSicht = await holePoolSicht(wartend)
        return jsonResult({
          libraryId,
          statusFilter: status ?? 'queued+running',
          jobAnzahl: total,
          wartend,
          ...poolSicht,
          ...(gescheitertKuerzlich ? { gescheitertKuerzlich } : {}),
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
