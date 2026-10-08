/**
 * @fileoverview MCP-Werkzeug `transformation_starten` (aus tools-erschliessen.ts ausgelagert, 200-Zeilen-Regel).
 *
 * @description
 * Standard-Template (oder ein angegebenes) auf Familien MIT Transkript —
 * Text aus MongoDB, der Job haengt an der Quelle. Je Quelle entscheidet
 * `transformation-start.ts` (Markdown/Sammeldateien ohne Transkript,
 * Gate-Entscheidung `erzwingen`). Welle B: die Lauf-Optionen der
 * Transformation (P6: Folien als Tabelle, Anhang in die Suche) gehen als
 * explizite Booleans in den Job; fehlen sie, entscheidet sichtbar die
 * Library-Voreinstellung bzw. die Vorlage bleibt unveraendert.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { JOB_HINWEIS, modellHinweis, runForSources, standardLlmModell, standardTemplate } from './tools-erschliessen-shared'
import { starteTransformation } from './transformation-start'
import { vorlageAktualisiertAm } from './tools-vorlagen'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

export const SOURCE_INPUTS = {
  sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (targetId aus Befunden)'),
  quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
  sourceIds: z.array(z.string().min(1)).min(1).max(30).optional()
    .describe('STAPEL (C3): mehrere Storage-Ids — eine Job-Zeile je Quelle, Fehler einzeln'),
}

/** Welle B: Lauf-Optionen der Transformation (P6) — fuer beide Werkzeuge. */
export const TRANSFORM_INPUTS = {
  folienAlsTabelle: z.boolean().optional().describe(
    'P6 „Slides als Tabelle fuehren": false nimmt das Feld slides fuer diesen Lauf aus der Vorlage. ' +
    'Weglassen = Vorlage unveraendert.'),
  anhangInSuche: z.boolean().optional().describe(
    'P6 „Anhaenge als Text in die Suche": steuert den unsichtbaren Ingest-Anhang mit den Transkripten der Quellen. ' +
    'Weglassen = Library-Voreinstellung (sichtbar im Job-Trace).'),
}

export function registerTransformationTool(server: McpServer): void {
  server.registerTool(
    'transformation_starten',
    {
      title: 'Transformation starten (SCHREIBT, langlaufend)',
      description:
        'Wendet das Standard-Template (oder ein angegebenes) auf Familien MIT Transkript an ' +
        '(Befund transformation_missing/transformation_stale) — das Transkript kommt aus MongoDB. ' +
        'Markdown-Quellen (.md/.mdx/.txt) brauchen KEIN Transkript: die Datei selbst ist der Text. ' +
        'Sammeldateien (kind: composite-transcript) werden wie im KS-UI aus den Twins ihrer ' +
        '_source_files aufgeloest; fehlt dort ein Transkript, kommt der Fehler mit den Dateinamen ' +
        'VOR dem Job-Start (dann genau diese Dateien mit quelle_erschliessen erschliessen). ' +
        'Haengt schon eine Transformation am Twin, entscheidet der Server ueber erzwingen (siehe dort) — ' +
        'eine aktuelle Transformation wird mit Begruendung abgesagt statt still uebersprungen. ' +
        'Lauf-Optionen wie im Pipeline-Sheet: folienAlsTabelle, anhangInSuche (P6). ' +
        'Die Transformation landet an der Quelle. Antwortet SOFORT mit jobId(s) — Status mit ' +
        'job_status/job_liste. Stapel via sourceIds. SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ...SOURCE_INPUTS,
        template: z.string().min(1).optional().describe('Template; weglassen = Standard-Template der Library'),
        zielsprache: z.string().min(2).max(5).optional().describe('Zielsprache (Default de)'),
        erzwingen: z.boolean().optional().describe(
          'WEGLASSEN ist der Normalfall: Der Server erzwingt von sich aus, wenn die Vorlage oder das ' +
          'Transkript juenger ist als die vorhandene Transformation oder nur eine ANDERE Vorlage ' +
          'transformiert wurde (jobs[].erzwungen nennt den Grund). Ist die Transformation aktuell, ' +
          'gibt es eine Absage OHNE Job. true = trotzdem neu erzeugen (z.B. Quelldatei geaendert); ' +
          'false = nie erzwingen — der Worker ueberspringt dann eine vorhandene Transformation.'),
        ...TRANSFORM_INPUTS,
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, sourceIds, template, zielsprache, erzwingen, folienAlsTabelle, anhangInSuche, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'transformation_starten', libraryId, akteur: mcpUserEmail(), begruendung, sourceId }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const effectiveTemplate = template ?? standardTemplate(library)
          // Modell nur aus der Library-Konfiguration — siehe quelle_erschliessen.
          const effectiveModell = standardLlmModell(library)
          // Einmal je Aufruf, nicht je Quelle: Massstab fuer „Transformation ueberholt".
          const vorlageStand = await vorlageAktualisiertAm(libraryId, userEmail, effectiveTemplate)
          const optionen = { slidesAsTable: folienAlsTabelle, appendixInSearch: anhangInSuche }
          const batch = await runForSources({
            provider, sourceId, quellPfad, sourceIds,
            start: (source) => starteTransformation({
              library, libraryId, userEmail, provider, source,
              template: effectiveTemplate, llmModel: effectiveModell, zielsprache, erzwingen, vorlageAktualisiertAm: vorlageStand, optionen,
            }),
          })
          return jsonResult({
            ok: batch.gescheitert === 0,
            gestartet: batch.gestartet,
            gescheitert: batch.gescheitert,
            jobs: batch.zeilen,
            template: effectiveTemplate,
            optionen: {
              folienAlsTabelle: folienAlsTabelle ?? 'Vorlage unveraendert',
              anhangInSuche: anhangInSuche ?? 'Library-Voreinstellung',
            },
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
