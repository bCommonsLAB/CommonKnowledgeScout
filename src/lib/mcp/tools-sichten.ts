/**
 * @fileoverview MCP-Werkzeuge fuer erzeugte Sichten (Wunschliste 2, W1; S1).
 *
 * @description
 * `sichten_regenerieren` loest `aktuell.py`/`projekte.py` ab: Berichte-Lauf
 * (Tiefe ≤ 3) → AKTUELL.md + PROJEKTE.md nach `Organisation/`. Seit S1 auch
 * SITZUNGEN.md — die Chronik der Arbeitssitzungen mit Claude aus den
 * Transformationen der Vorlage `chatverlauf-de` (MongoDB). `sichten` waehlt
 * aus; Vorgabe sind alle drei, damit bestehende Aufrufer gleich bleiben. Mit
 * `nurVorschau` liefert es die gerenderten Sichten OHNE zu schreiben — der
 * Checkpoint, bevor die Session den Export bestaetigt.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { regenerateSichten } from '@/lib/agent-view/sichten/regenerate-sichten'
import { ALLE_SICHTEN } from '@/lib/agent-view/sichten/sitzungen-types'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'

const DATEI_JE_SICHT = { aktuell: 'AKTUELL.md', projekte: 'PROJEKTE.md', sitzungen: 'SITZUNGEN.md' } as const

/** Registriert `sichten_regenerieren` (siehe Datei-Kommentar). */
export function registerSichtenTools(server: McpServer): void {
  server.registerTool(
    'sichten_regenerieren',
    {
      title: 'AKTUELL.md + PROJEKTE.md + SITZUNGEN.md erzeugen (SCHREIBT)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Erzeugt die Sichten AKTUELL.md (woran arbeite ich gerade), PROJEKTE.md (Katalog + ' +
        'Themenregister) und SITZUNGEN.md (Chronik der Arbeitssitzungen mit Claude aus den Sitzungsnotizen ' +
        'der Vorlage chatverlauf-de, je Vorhaben in Archiv-Ordnung, zuletzt "Ohne Vorhaben") und schreibt sie ' +
        'nach Organisation/ — Abloesung der Skripte aktuell.py/projekte.py und der handgepflegten Notiz-Kopien. ' +
        'sichten waehlt aus (Vorgabe alle drei). Liest Berichte bis Tiefe 3 frisch (Bereich/Projekt), dauert auf ' +
        'OneDrive ~20-40 s. nurVorschau=true rendert ohne zu schreiben (Checkpoint). SCHREIBT die gewaehlten ' +
        'Dateien (ersetzt die alten); nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sichten: z.array(z.enum(['aktuell', 'projekte', 'sitzungen'])).min(1).optional()
          .describe('Welche Sichten erzeugt werden; weglassen = alle drei'),
        nurVorschau: z.boolean().optional()
          .describe('true = nur rendern und zurueckgeben, nichts schreiben'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sichten, nurVorschau, begruendung }) => {
      try {
        return await mitProtokoll({
          werkzeug: 'sichten_regenerieren', libraryId, akteur: mcpUserEmail(), begruendung,
          modus: nurVorschau === true ? 'vorschau' : undefined,
        }, async () => {
          const userEmail = mcpUserEmail()
          const library = await requireLibrary(userEmail, libraryId)
          pruefeArchivpflege(library, 'sichten_regenerieren')
          const provider = await requireProvider(userEmail, libraryId)
          const started = Date.now()
          const ergebnis = await regenerateSichten({ library, provider, nurVorschau: nurVorschau === true, sichten })
          const dateien = (sichten ?? ALLE_SICHTEN).map((s) => DATEI_JE_SICHT[s]).join(', ')
          return jsonResult({
            ok: true,
            modus: nurVorschau === true ? 'vorschau' : 'geschrieben',
            dauerMs: Date.now() - started,
            ...ergebnis,
            hinweis:
              nurVorschau === true
                ? 'Nichts geschrieben — mit nurVorschau=false exportieren.'
                : `${dateien} in Organisation/ ersetzt (Dateien tragen generated_by: knowledgescout/sichten).`,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
