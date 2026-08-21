/**
 * @fileoverview MCP-Werkzeuge, die Inhalt erzeugen (Welle 5, Stufe 2).
 *
 * @description
 * Die zwei Inhalts-Motoren, die dem Aufraeum-Szenario fehlten (Cowork-Befund:
 * „nichts, was Inhalt erzeugt"), im Anstossen-und-Nachsehen-Muster — die Jobs
 * laufen laenger als das ~60s-Client-Limit, deshalb kommt sofort eine jobId
 * zurueck und `job_status` schaut nach:
 *
 * - `quelle_erschliessen`: Audio/Video ueber den External-Jobs-Worker
 *   (Transkript, mit Template auch Transformation+Ingest). PDF/Office sind
 *   Ausbaustufe (anderer Upload-Contract) — Fehler sagt das ehrlich.
 * - `transformation_starten`: Standard-Template auf eine Familie MIT
 *   Transkript — Text kommt aus MongoDB (Wahrheit), der Job haengt an der
 *   Quelle, dort landet die Transformation.
 * - Beide nehmen auch `sourceIds` als Stapel (Pilot-Wunschliste C3): eine
 *   Job-Zeile je Quelle, Fehler einzeln statt Stapel-Abbruch.
 * - Job-Beobachtung (`job_status`/`job_liste`): eigene Datei `tools-jobs.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { enqueueSourceTranscribeJob, enqueueTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { getFileKind } from '@/lib/shadow-twin/file-kind'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { JOB_HINWEIS, runForSources, standardTemplate } from './tools-erschliessen-shared'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

const SOURCE_INPUTS = {
  sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (targetId aus Befunden)'),
  quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
  sourceIds: z.array(z.string().min(1)).min(1).max(30).optional()
    .describe('STAPEL (C3): mehrere Storage-Ids — eine Job-Zeile je Quelle, Fehler einzeln'),
}

/** Registriert die Erschliessungs-Werkzeuge (siehe Datei-Kommentar). */
export function registerErschliessenTools(server: McpServer): void {
  server.registerTool(
    'quelle_erschliessen',
    {
      title: 'Quelle erschliessen (SCHREIBT, langlaufend)',
      description:
        'Startet die Pipeline fuer Quellen ohne Twin (Befund source_without_twin): Audio/Video ' +
        'wird transkribiert; mit template (Default: Standard-Template der Library) entstehen auch ' +
        'Transformation + Galerie-Eintrag. Antwortet SOFORT mit jobId(s) — Verarbeitung dauert ' +
        'Minuten, Status mit job_status/job_liste. Stapel via sourceIds. PDF/Office: noch nicht ' +
        'ueber die Bruecke — im KS-UI erschliessen (Ausbaustufe). SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ...SOURCE_INPUTS,
        template: z.string().min(1).optional().describe('Transformations-Template; weglassen = Standard-Template der Library; "nur_transkript" = bewusst ohne Transformation'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, template, zielsprache }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const effectiveTemplate = template === 'nur_transkript' ? undefined : template ?? standardTemplate(library)
        const batch = await runForSources({
          provider, sourceId, quellPfad, sourceIds,
          start: async (source) => {
            const kind = getFileKind(source.name)
            if (kind !== 'audio' && kind !== 'video') {
              throw new Error(
                `"${source.name}" ist ${kind} — quelle_erschliessen kann in v1 nur Audio/Video; ` +
                  'PDF/Office/Markdown bitte im KS-UI erschliessen (Ausbaustufe der Bruecke)',
              )
            }
            const { jobId } = await enqueueSourceTranscribeJob({
              libraryId, userEmail, source, mediaType: kind,
              template: effectiveTemplate, targetLanguage: zielsprache,
            })
            return jobId
          },
        })
        return jsonResult({
          ok: batch.gescheitert === 0,
          gestartet: batch.gestartet,
          gescheitert: batch.gescheitert,
          jobs: batch.zeilen,
          template: effectiveTemplate ?? null,
          hinweis: JOB_HINWEIS,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'transformation_starten',
    {
      title: 'Transformation starten (SCHREIBT, langlaufend)',
      description:
        'Wendet das Standard-Template (oder ein angegebenes) auf Familien MIT Transkript an ' +
        '(Befund transformation_missing/transformation_stale). Das Transkript kommt aus MongoDB; ' +
        'die Transformation landet an der Quelle. Antwortet SOFORT mit jobId(s) — Status mit ' +
        'job_status/job_liste. Stapel via sourceIds. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ...SOURCE_INPUTS,
        template: z.string().min(1).optional().describe('Template; weglassen = Standard-Template der Library'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, template, zielsprache }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const effectiveTemplate = template ?? standardTemplate(library)
        const batch = await runForSources({
          provider, sourceId, quellPfad, sourceIds,
          start: async (source) => {
            const service = new ShadowTwinService({
              library, userEmail, sourceId: source.itemId, sourceName: source.name, parentId: source.parentId, provider,
            })
            const transcript = await service.getMarkdown({ kind: 'transcript', targetLanguage: '' })
            if (!transcript?.markdown?.trim()) {
              throw new Error(
                `Kein Transkript fuer "${source.name}" — zuerst quelle_erschliessen (oder Pipeline im KS-UI)`,
              )
            }
            const { jobId } = await enqueueTemplateOnTextJob({
              libraryId, userEmail, source,
              template: effectiveTemplate, targetLanguage: zielsprache,
              extractedText: transcript.markdown,
            })
            return jobId
          },
        })
        return jsonResult({
          ok: batch.gescheitert === 0,
          gestartet: batch.gestartet,
          gescheitert: batch.gescheitert,
          jobs: batch.zeilen,
          template: effectiveTemplate,
          hinweis: JOB_HINWEIS,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
