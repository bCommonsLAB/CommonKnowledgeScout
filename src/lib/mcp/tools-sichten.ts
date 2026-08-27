/**
 * @fileoverview MCP-Werkzeuge fuer erzeugte Sichten (Wunschliste 2, W1).
 *
 * @description
 * `sichten_regenerieren` loest `aktuell.py`/`projekte.py` ab: Berichte-Lauf
 * (Tiefe ≤ 3) → AKTUELL.md + PROJEKTE.md nach `Organisation/`. Mit
 * `nurVorschau` liefert es die gerenderten Sichten OHNE zu schreiben — der
 * Checkpoint, bevor die Session den Export bestaetigt. Damit endet jeder
 * Aufraeumlauf und jeder Tagesabschluss mit einem Aufruf statt mit
 * „Peter, bitte zwei Skripte starten".
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { regenerateSichten } from '@/lib/agent-view/sichten/regenerate-sichten'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

/** Registriert `sichten_regenerieren` (siehe Datei-Kommentar). */
export function registerSichtenTools(server: McpServer): void {
  server.registerTool(
    'sichten_regenerieren',
    {
      title: 'AKTUELL.md + PROJEKTE.md erzeugen (SCHREIBT)',
      description:
        'Erzeugt die Sichten AKTUELL.md (woran arbeite ich gerade) und PROJEKTE.md (Katalog + ' +
        'Themenregister) aus allen BERICHT.md der Library und schreibt sie nach Organisation/ — ' +
        'Abloesung der Skripte aktuell.py/projekte.py. Liest Berichte bis Tiefe 3 frisch ' +
        '(Bereich/Projekt), dauert auf OneDrive ~20-40 s. nurVorschau=true rendert ohne zu ' +
        'schreiben (Checkpoint). SCHREIBT zwei Dateien (ersetzt die alten); nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        nurVorschau: z.boolean().optional()
          .describe('true = nur rendern und zurueckgeben, nichts schreiben'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, nurVorschau , begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'sichten_regenerieren', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          const provider = await requireProvider(userEmail, libraryId)
          const started = Date.now()
          const ergebnis = await regenerateSichten({ library, provider, nurVorschau: nurVorschau === true })
          return jsonResult({
            ok: true,
            modus: nurVorschau === true ? 'vorschau' : 'geschrieben',
            dauerMs: Date.now() - started,
            ...ergebnis,
            hinweis:
              nurVorschau === true
                ? 'Nichts geschrieben — mit nurVorschau=false exportieren.'
                : 'AKTUELL.md und PROJEKTE.md in Organisation/ ersetzt (Dateien tragen generated_by: knowledgescout/sichten).',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
