/**
 * @fileoverview Werkzeuge der MCP-Bruecke (Welle 5) — duenn ueber den Services.
 *
 * @description
 * Genau die fuenf Werkzeuge aus dem Testszenario
 * (`docs/concepts/welle-5-mcp-testszenario.md` §2): Bibliotheken auflisten,
 * Coverage lesen/scannen, Engine pruefen/synchronisieren. Jedes Werkzeug ruft
 * DIESELBEN Funktionen wie die API-Routen — kein drittes Pruefsystem, keine
 * neuen Schreibpfade. Bewusst NICHT dabei: erschliessen (Job-Start bleibt
 * Mensch-Checkpoint), familie_umziehen (Welle 0e fehlt), verifizieren
 * (bleibt Mensch, F4 — ein Agent verifiziert nie sich selbst).
 *
 * Fehler werden als `isError`-Ergebnis gemeldet (Klartext), nie verschluckt.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { scanLibraryCoverage } from '@/lib/agent-view/run-coverage-scan'
import { FileLogger } from '@/lib/debug/logger'
import { getCoverageReport, saveCoverageReport } from '@/lib/repositories/agent-view-coverage-repo'
import { LibraryService } from '@/lib/services/library-service'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import type { Library } from '@/types/library'
import { summarizeCoverageReport } from './coverage-view'
import { summarizeSyncReport } from './sync-view'

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
  [key: string]: unknown
}

function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error)
  FileLogger.error('mcp-tools', 'Werkzeug fehlgeschlagen', { error: message })
  return { content: [{ type: 'text', text: `Fehler: ${message}` }], isError: true }
}

/** User der Bruecke (Pilot: EIN Key ↔ EIN User, siehe `auth.ts`). */
function mcpUserEmail(): string {
  const email = process.env.MCP_USER_EMAIL?.trim() ?? ''
  if (email === '') throw new Error('MCP_USER_EMAIL nicht konfiguriert')
  return email
}

async function requireLibrary(userEmail: string, libraryId: string): Promise<Library> {
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Bibliothek nicht gefunden oder kein Zugriff: ${libraryId}`)
  return library
}

const LIBRARY_ID = z.string().min(1).describe('Id der Library (aus bibliotheken_auflisten)')
const FOLDER_ID = z
  .string()
  .min(1)
  .optional()
  .describe('Storage-Ordner-Id fuer einen Teilbaum; weglassen = ganze Library')

/** Registriert alle Werkzeuge der Bruecke auf dem MCP-Server. */
export function registerKnowledgeScoutTools(server: McpServer): void {
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
        'Liest den JUENGSTEN Coverage-Report der Agentensicht (Befunde, Twin-Familien, Zaehler), ' +
        'optional auf einen library-relativen Pfad gefiltert. Rechnet nichts neu — bei veraltetem ' +
        'Report zuerst abdeckung_scannen. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        pfad: z.string().optional().describe('Library-relativer Ordnerpfad, z. B. "6. bCommonsLab prototyping/25.01 Common Secretary"'),
        maxBefunde: z.number().int().min(1).max(1000).optional(),
        maxFamilien: z.number().int().min(1).max(1000).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, pfad, maxBefunde, maxFamilien }) => {
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
            pathPrefix: pfad ?? null,
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
        'Expliziter Coverage-Scan (Agentensicht) — berechnet Befunde und Twin-Familien neu und ' +
        'speichert den wegwerfbaren Report. Library-weite Scans koennen Minuten dauern; fuer das ' +
        'Aufraeum-Szenario einen Teilbaum (folderId) scannen. Schreibt NUR den Report-Cache.',
      inputSchema: { libraryId: LIBRARY_ID, folderId: FOLDER_ID },
    },
    async ({ libraryId, folderId }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const report = await scanLibraryCoverage({ libraryId, userEmail, folderId: folderId ?? null })
        const stored = await saveCoverageReport(report)
        return jsonResult(
          summarizeCoverageReport({
            report: stored.report,
            generatedAt: stored.generatedAt,
            storedGapsTruncated: stored.gapsTruncated,
            totalGaps: stored.totalGaps,
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
        'als Plan-Vorschau. Es wird NICHTS geschrieben. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID, folderId: FOLDER_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, folderId }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const report = await runLibrarySync({
          libraryId, userEmail, mode: 'check', preset: 'repair',
          scope: folderId ? { folderId } : {},
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
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, preset, folderId }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const report = await runLibrarySync({
          libraryId, userEmail, mode: 'repair', preset,
          scope: folderId ? { folderId } : {},
        })
        return jsonResult(summarizeSyncReport(report))
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
