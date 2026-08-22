/**
 * @fileoverview Werkzeuge der MCP-Bruecke (Welle 5) — duenn ueber den Services.
 *
 * @description
 * Lese-/Sync-Werkzeuge aus dem Testszenario
 * (`docs/concepts/welle-5-mcp-testszenario.md` §2): Bibliotheken auflisten,
 * Coverage lesen/scannen, Engine pruefen/synchronisieren; dazu die
 * Umzugs-Werkzeuge aus `tools-umzug.ts` (Welle 0e). Jedes Werkzeug ruft
 * DIESELBEN Funktionen wie die API-Routen — kein drittes Pruefsystem, keine
 * neuen Schreibpfade. Bewusst NICHT dabei: loeschen (Ausbaustufe; solange in
 * einen Klaer-Ordner verschieben), verifizieren (bleibt Mensch, F4).
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { scanLibraryCoverage } from '@/lib/agent-view/run-coverage-scan'
import { getCoverageReport, saveCoverageReport } from '@/lib/repositories/agent-view-coverage-repo'
import { LibraryService } from '@/lib/services/library-service'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { summarizeCoverageReport } from './coverage-view'
import { summarizeSyncReport } from './sync-view'
import {
  FOLDER_ID,
  LIBRARY_ID,
  SCOPE_PFAD,
  errorResult,
  jsonResult,
  mcpUserEmail,
  requireLibrary,
  resolveScope,
} from './tool-shared'
import { registerErschliessenTools } from './tools-erschliessen'
import { registerJobTools } from './tools-jobs'
import { registerInfoTool } from './tools-info'
import { registerSichtenTools } from './tools-sichten'
import { registerOrdnerTools } from './tools-ordner'
import { registerUmzugTools } from './tools-umzug'

/** Registriert alle Werkzeuge der Bruecke auf dem MCP-Server. */
export function registerKnowledgeScoutTools(server: McpServer): void {
  registerUmzugTools(server)
  registerOrdnerTools(server)
  registerErschliessenTools(server)
  registerJobTools(server)
  registerSichtenTools(server)
  registerInfoTool(server)
  server.registerTool(
    'bibliotheken_auflisten',
    {
      title: 'Bibliotheken auflisten',
      description: 'Listet die KnowledgeScout-Libraries des Users (Id + Name). Liest nur.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const libraries = await LibraryService.getInstance().getUserLibraries(mcpUserEmail())
        return jsonResult(libraries.map((library) => ({ id: library.id, name: library.label })))
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'abdeckung_lesen',
    {
      title: 'Coverage lesen',
      description:
        'IMMER ZUERST verwenden: liest den GESPEICHERTEN Coverage-Report (Befunde, Twin-Familien, ' +
        'Ordnerliste mit folderIds) — antwortet sofort, ohne den Storage anzufassen. Optional auf ' +
        'einen library-relativen Pfad gefiltert. Die gelieferten folderIds sind der Schluessel fuer ' +
        'Teilbaum-Scans/-Checks. Neu gerechnet wird nur mit abdeckung_scannen (explizit). Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().optional().describe('Library-relativer Ordnerpfad, z. B. "6. bCommonsLab prototyping/25.01 Common Secretary"'),
        akteur: z.enum(['mensch', 'cowork', 'knowledgescout']).optional()
          .describe('Nur Befunde dieses Akteurs („was ist meine Arbeit?“)'),
        zyklusSchritt: z.number().int().min(1).max(4).optional()
          .describe('Nur Befunde dieses Zyklus-Schritts (1-4)'),
        nurZaehler: z.boolean().optional()
          .describe('Nur Zaehler + Ordnerliste liefern (Befund-/Familienlisten leer) — fuer grosse Reports'),
        maxBefunde: z.number().int().min(1).max(1000).optional(),
        maxFamilien: z.number().int().min(1).max(1000).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, akteur, zyklusSchritt, nurZaehler, maxBefunde, maxFamilien }) => {
      try {
        await requireLibrary(mcpUserEmail(), libraryId)
        const stored = await getCoverageReport(libraryId)
        if (!stored) {
          return jsonResult({
            status: 'noch_nie_gescannt',
            hinweis: 'Es gibt keinen Coverage-Report — zuerst abdeckung_scannen ausfuehren.',
          })
        }
        return jsonResult(
          summarizeCoverageReport({
            report: stored.report,
            generatedAt: stored.generatedAt,
            storedGapsTruncated: stored.gapsTruncated,
            totalGaps: stored.totalGaps,
            delta: stored.delta ?? null,
            deltaHinweis: stored.deltaHinweis ?? null,
            pathPrefix: pfad ?? null,
            akteur: akteur ?? null,
            zyklusSchritt: zyklusSchritt ?? null,
            nurZaehler: nurZaehler === true,
            maxGaps: maxBefunde,
            maxFamilies: maxFamilien,
          }),
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'abdeckung_scannen',
    {
      title: 'Coverage neu scannen',
      description:
        'Expliziter Coverage-Scan — berechnet Befunde und Twin-Familien neu und speichert den ' +
        'wegwerfbaren Report. TEUER: ein Storage-API-Call pro Ordner, und der MCP-Client bricht ' +
        'Aufrufe nach ~60 Sekunden ab. Deshalb IMMER auf einen Teilbaum begrenzen — per folderId ' +
        'ODER per pfad (braucht keinen Report). Der grosse Erst-Scan einer Library gehoert in die ' +
        'KS-Oberflaeche (Agentensicht → „Neu scannen"). Schreibt NUR den Report-Cache.',
      inputSchema: { libraryId: LIBRARY_ID, folderId: FOLDER_ID, pfad: SCOPE_PFAD },
    },
    async ({ libraryId, folderId, pfad }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const scope = await resolveScope({ userEmail, libraryId, folderId, pfad })
        const report = await scanLibraryCoverage({
          libraryId, userEmail, folderId: scope ?? null,
          // Bei pfad-Aufruf kennt der Report seinen library-relativen Scope —
          // damit koennen spaetere library-relative Filter abgebildet werden.
          scopePath: pfad ?? null,
        })
        const stored = await saveCoverageReport(report)
        return jsonResult(
          summarizeCoverageReport({
            report: stored.report,
            generatedAt: stored.generatedAt,
            storedGapsTruncated: stored.gapsTruncated,
            totalGaps: stored.totalGaps,
            delta: stored.delta ?? null,
            deltaHinweis: stored.deltaHinweis ?? null,
          }),
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'twins_pruefen',
    {
      title: 'Twins pruefen (check)',
      description:
        'Sync-Engine im check-Modus: Konflikte, Alt-Namen, fehlende Spiegel, Pipeline-Bedarf — ' +
        'als Plan-Vorschau. Es wird NICHTS geschrieben, aber es ist ein LIVE-Lauf gegen den ' +
        'Storage (kein Cache), und der MCP-Client bricht nach ~60 Sekunden ab: IMMER auf einen ' +
        'Teilbaum begrenzen — per folderId ODER per pfad (braucht keinen Report). Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID, folderId: FOLDER_ID, pfad: SCOPE_PFAD },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, folderId, pfad }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const scope = await resolveScope({ userEmail, libraryId, folderId, pfad })
        const report = await runLibrarySync({
          libraryId, userEmail, mode: 'check', preset: 'repair',
          scope: scope ? { folderId: scope } : {},
        })
        return jsonResult(summarizeSyncReport(report))
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'twins_synchronisieren',
    {
      title: 'Twins synchronisieren (SCHREIBT)',
      description:
        'Sync-Engine im repair-Modus mit Preset: "import" = Handkorrekturen aus dem Spiegel nach ' +
        'MongoDB uebernehmen (bei Konflikten IMMER zuerst), "repair" = beide Seiten konsistent ' +
        'machen, "export" = Spiegel aus MongoDB regenerieren. SCHREIBT in MongoDB und Storage — ' +
        'nur nach Bestaetigung durch den Menschen ausfuehren (Testszenario Checkpoint 3).',
      inputSchema: {
        libraryId: LIBRARY_ID,
        preset: z.enum(['repair', 'import', 'export']).describe('Welcher Knopf gedrueckt wird'),
        folderId: FOLDER_ID,
        pfad: SCOPE_PFAD,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, preset, folderId, pfad }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const scope = await resolveScope({ userEmail, libraryId, folderId, pfad })
        const report = await runLibrarySync({
          libraryId, userEmail, mode: 'repair', preset,
          scope: scope ? { folderId: scope } : {},
        })
        return jsonResult(summarizeSyncReport(report))
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
