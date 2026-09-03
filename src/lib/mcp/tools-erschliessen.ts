/**
 * @fileoverview MCP-Werkzeuge, die Inhalt erzeugen (Welle 5, Stufe 2).
 *
 * @description
 * Die zwei Inhalts-Motoren, die dem Aufraeum-Szenario fehlten (Cowork-Befund:
 * „nichts, was Inhalt erzeugt"), im Anstossen-und-Nachsehen-Muster — die Jobs
 * laufen laenger als das ~60s-Client-Limit, deshalb kommt sofort eine jobId
 * zurueck und `job_status` schaut nach:
 *
 * - `quelle_erschliessen`: Audio/Video (Transkript, mit Template auch
 *   Transformation+Ingest) UND — seit A1 — PDF/Office ueber die Job-Form der
 *   Pipeline-Route (upload-frei, der Worker laedt das Binary selbst).
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
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { entscheideErzwingen } from './alt-format-erkennung'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { documentMediaKindFromName, enqueueSourceDocumentJob } from '@/lib/external-jobs/enqueue-document-job'
import { enqueueSourceTranscribeJob, enqueueTemplateOnTextJob } from '@/lib/external-jobs/enqueue-secretary-job'
import { getFileKind } from '@/lib/shadow-twin/file-kind'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { JOB_HINWEIS, modellHinweis, runForSources, standardLlmModell, standardTemplate } from './tools-erschliessen-shared'
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
        'wird transkribiert, PDF/DOCX/XLSX/PPTX extrahiert (A1); mit template (Default: ' +
        'Standard-Template der Library) entstehen auch Transformation + Galerie-Eintrag. ' +
        'Antwortet SOFORT mit jobId(s) — Status mit job_status/job_liste. Stapel via sourceIds. ' +
        'VORHER twins_synchronisieren (import→repair→export) laufen lassen: Es adoptiert Quellen, ' +
        'deren Auswertung schon existiert, aber noch nicht verbucht ist — in einem gemessenen Lauf ' +
        'rund 90 Stueck, die der Scan sonst als unerschlossen meldet und die hier ein zweites Mal ' +
        'transkribiert wuerden. Ebenso VORHER umbenennen (familie_umziehen), nicht nachher. ' +
        'SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ...SOURCE_INPUTS,
        template: z.string().min(1).optional().describe('Transformations-Template; weglassen = Standard-Template der Library; "nur_transkript" = bewusst ohne Transformation'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
        erzwingen: z.boolean().optional().describe(
          'WEGLASSEN ist der Normalfall: Der Server erkennt die Alt-Format-Konstellation ' +
          '(Transformation OHNE Transkript) selbst und uebergeht das Extract-Gate dann von sich ' +
          'aus — die Antwort weist das je Quelle als erzwungen="alt_format_erkannt" aus. ' +
          'true = immer uebergehen, false = nie (auch nicht bei erkanntem Alt-Format). ' +
          'Hintergrund: Ohne Uebergehen liest das Gate die vorhandene Transformation als Beweis ' +
          'fuers Transkript, der Job wird completed und schreibt nichts.'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, template, zielsprache, erzwingen , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'quelle_erschliessen', libraryId, akteur: mcpUserEmail(), begruendung, sourceId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const effectiveTemplate = template === 'nur_transkript' ? undefined : template ?? standardTemplate(library)
          // Das Modell kommt AUSSCHLIESSLICH aus der Library-Konfiguration
          // (Owner-Entscheid 28.08.2026): Der Client waehlt die VORLAGE —
          // eine fachliche Entscheidung. Welches Modell sie ausfuehrt, ist
          // Infrastruktur und gehoert dem Betreiber der Library, nicht dem
          // Agenten. Eine Modellwahl je Aufruf hiesse: zwei Laeufe derselben
          // Vorlage koennten verschieden ausfallen, ohne dass das Archiv es
          // einem ansieht.
          const effectiveModell = standardLlmModell(library)
          const batch = await runForSources({
            provider, sourceId, quellPfad, sourceIds,
            start: async (source) => {
              const kind = getFileKind(source.name)
              // W9: Die Alt-Format-Konstellation ist maschinell eindeutig —
              // sie hier zu pruefen kostet eine indizierte Abfrage und
              // erspart dem Agenten eine Entscheidung, die er nur raten kann.
              const twins = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [source.itemId] })
              const entscheidung = entscheideErzwingen({
                angefordert: erzwingen,
                doc: twins.get(source.itemId) ?? null,
              })
              if (kind === 'audio' || kind === 'video') {
                const { jobId } = await enqueueSourceTranscribeJob({
                  libraryId, userEmail, source, mediaType: kind,
                  template: effectiveTemplate, llmModel: effectiveModell, targetLanguage: zielsprache,
                  erzwingen: entscheidung.erzwingen,
                })
                return { jobId, erzwungen: entscheidung.grund }
              }
              const documentKind = documentMediaKindFromName(source.name)
              if (documentKind) {
                const { jobId } = await enqueueSourceDocumentJob({
                  libraryId, userEmail, source, mediaKind: documentKind,
                  template: effectiveTemplate, llmModel: effectiveModell, targetLanguage: zielsprache,
                  erzwingen: entscheidung.erzwingen,
                })
                return { jobId, erzwungen: entscheidung.grund }
              }
              throw new Error(
                `"${source.name}" ist ${kind} — quelle_erschliessen kann Audio/Video/PDF/DOCX/XLSX/PPTX; ` +
                  'Markdown-Familien laufen ueber transformation_starten',
              )
            },
          })
          return jsonResult({
            ok: batch.gescheitert === 0,
            gestartet: batch.gestartet,
            gescheitert: batch.gescheitert,
            jobs: batch.zeilen,
            template: effectiveTemplate ?? null,
            // Die Sammelangabe sagt nur, was ANGEFORDERT war; was tatsaechlich
            // galt, steht je Quelle in `jobs[].erzwungen`.
            erzwingenAngefordert: erzwingen ?? null,
            erzwungenAutomatisch: batch.zeilen.filter((z) => z.erzwungen === 'alt_format_erkannt').length,
            llmModell: effectiveModell ?? null,
            modellHerkunft: modellHinweis(effectiveModell),
            hinweis: JOB_HINWEIS,
          })
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
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, template, zielsprache , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'transformation_starten', libraryId, akteur: mcpUserEmail(), begruendung, sourceId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const effectiveTemplate = template ?? standardTemplate(library)
          // Modell nur aus der Library-Konfiguration — siehe quelle_erschliessen.
          const effectiveModell = standardLlmModell(library)
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
                template: effectiveTemplate, llmModel: effectiveModell, targetLanguage: zielsprache,
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
            llmModell: effectiveModell ?? null,
            modellHerkunft: modellHinweis(effectiveModell),
            hinweis: JOB_HINWEIS,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
