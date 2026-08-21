/**
 * @fileoverview Erschliessungs-Werkzeuge der MCP-Bruecke (Welle 5, Stufe 2).
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
 * - Job-Beobachtung (`job_status`/`job_liste`): eigene Datei `tools-jobs.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { enqueueSourceTranscribeJob, enqueueTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { getFileKind } from '@/lib/shadow-twin/file-kind'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { resolveItemByPath } from './resolve-folder'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

const JOB_HINWEIS =
  'Job laeuft im Hintergrund (External-Jobs-Worker im KS-Server) — Status mit job_status abfragen; danach abdeckung_scannen (Teilbaum).'

async function resolveSourceItem(
  provider: StorageProvider,
  sourceId?: string,
  quellPfad?: string,
): Promise<{ itemId: string; parentId: string; name: string; mimeType?: string }> {
  if (sourceId && quellPfad) throw new Error('Entweder sourceId ODER quellPfad angeben — nicht beides')
  if (quellPfad) {
    const item = await resolveItemByPath(provider, quellPfad, 'file')
    return { itemId: item.id, parentId: item.parentFolderId, name: item.name }
  }
  if (!sourceId) throw new Error('sourceId oder quellPfad ist Pflicht')
  const item = await provider.getItemById(sourceId)
  if (!item || item.type !== 'file') throw new Error(`${sourceId} ist keine Datei`)
  return { itemId: item.id, parentId: item.parentId, name: item.metadata.name }
}

function standardTemplate(library: Library): string {
  const template = library.config?.secretaryService?.template?.trim() ?? ''
  if (template === '') {
    throw new Error(
      'Kein Standard-Template in der Library konfiguriert (Einstellungen → Secretary) — template explizit angeben',
    )
  }
  return template
}

/** Registriert die Erschliessungs-Werkzeuge (siehe Datei-Kommentar). */
export function registerErschliessenTools(server: McpServer): void {
  server.registerTool(
    'quelle_erschliessen',
    {
      title: 'Quelle erschliessen (SCHREIBT, langlaufend)',
      description:
        'Startet die Pipeline fuer EINE Quelle ohne Twin (Befund source_without_twin): Audio/Video ' +
        'wird transkribiert; mit template (Default: Standard-Template der Library) entstehen auch ' +
        'Transformation + Galerie-Eintrag. Antwortet SOFORT mit einer jobId — Verarbeitung dauert ' +
        'Minuten, Status mit job_status abfragen. PDF/Office: noch nicht ueber die Bruecke — im ' +
        'KS-UI erschliessen (Ausbaustufe). SCHREIBT (Mongo + Spiegel); nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (targetId aus Befunden)'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
        template: z.string().min(1).optional().describe('Transformations-Template; weglassen = Standard-Template der Library; "nur_transkript" = bewusst ohne Transformation'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, template, zielsprache }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const source = await resolveSourceItem(provider, sourceId, quellPfad)
        const kind = getFileKind(source.name)
        if (kind !== 'audio' && kind !== 'video') {
          throw new Error(
            `"${source.name}" ist ${kind} — quelle_erschliessen kann in v1 nur Audio/Video; ` +
              'PDF/Office/Markdown bitte im KS-UI erschliessen (Ausbaustufe der Bruecke)',
          )
        }
        const effectiveTemplate = template === 'nur_transkript' ? undefined : template ?? standardTemplate(library)
        const { jobId } = await enqueueSourceTranscribeJob({
          libraryId, userEmail, source, mediaType: kind,
          template: effectiveTemplate, targetLanguage: zielsprache,
        })
        return jsonResult({
          ok: true, jobId, quelle: source.name,
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
        'Wendet das Standard-Template (oder ein angegebenes) auf eine Familie MIT Transkript an ' +
        '(Befund transformation_missing/transformation_stale). Das Transkript kommt aus MongoDB; ' +
        'die Transformation landet an der Quelle. Antwortet SOFORT mit jobId — Status mit ' +
        'job_status. SCHREIBT (Mongo + Spiegel); nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (sourceId aus Familien/Befunden)'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
        template: z.string().min(1).optional().describe('Template; weglassen = Standard-Template der Library'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, template, zielsprache }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const source = await resolveSourceItem(provider, sourceId, quellPfad)
        const service = new ShadowTwinService({
          library, userEmail, sourceId: source.itemId, sourceName: source.name, parentId: source.parentId, provider,
        })
        const transcript = await service.getMarkdown({ kind: 'transcript', targetLanguage: '' })
        if (!transcript?.markdown?.trim()) {
          throw new Error(
            `Kein Transkript fuer "${source.name}" — zuerst quelle_erschliessen (oder Pipeline im KS-UI)`,
          )
        }
        const effectiveTemplate = template ?? standardTemplate(library)
        const { jobId } = await enqueueTemplateOnTextJob({
          libraryId, userEmail, source,
          template: effectiveTemplate, targetLanguage: zielsprache,
          extractedText: transcript.markdown,
        })
        return jsonResult({ ok: true, jobId, quelle: source.name, template: effectiveTemplate, hinweis: JOB_HINWEIS })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
