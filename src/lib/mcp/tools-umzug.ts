/**
 * @fileoverview Umzugs-Werkzeuge der MCP-Bruecke (Welle 0e ueber MCP).
 *
 * @description
 * Umbenennen/Verschieben gehoert in KnowledgeScout, nie in direkte
 * Dateisystem-Zugriffe des Agenten: `familie_umziehen` nutzt den
 * vorhandenen Service `moveFamily` (Import → Siblings → Quelle → Mongo →
 * alter Spiegel weg → Export, Contract §7) — Datenbank und Spiegel ziehen
 * in EINEM Zug mit. Fuer Dateien OHNE Twin-Familie (z. B. abgeschnittene
 * Sync-Reste) bewegt derselbe Weg nur die Datei. `ordner_umbenennen` ist
 * Storage-only und Mongo-transparent (Provider-Ids bleiben stabil, die
 * `_`-Ordner wandern mit ihrem Ordner mit).
 *
 * Loeschen ist BEWUSST kein Werkzeug (Ausbaustufe): solange in einen
 * Klaer-Ordner verschieben statt loeschen.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { moveFamily } from '@/lib/shadow-twin/move-family'
import type { StorageProvider } from '@/lib/storage/types'
import { resolveFolderIdByPath, resolveItemByPath } from './resolve-folder'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

async function resolveSourceId(provider: StorageProvider, sourceId?: string, quellPfad?: string): Promise<string> {
  if (sourceId && quellPfad) throw new Error('Entweder sourceId ODER quellPfad angeben — nicht beides')
  if (sourceId) return sourceId
  if (!quellPfad) throw new Error('sourceId oder quellPfad ist Pflicht')
  return (await resolveItemByPath(provider, quellPfad, 'file')).id
}

async function resolveTargetFolder(
  provider: StorageProvider,
  neuerOrdnerId?: string,
  neuerOrdnerPfad?: string,
): Promise<string | undefined> {
  if (neuerOrdnerId && neuerOrdnerPfad) {
    throw new Error('Entweder neuerOrdnerId ODER neuerOrdnerPfad angeben — nicht beides')
  }
  if (neuerOrdnerId) return neuerOrdnerId
  if (!neuerOrdnerPfad) return undefined
  return resolveFolderIdByPath(provider, neuerOrdnerPfad)
}

/** Registriert die Umzugs-Werkzeuge (siehe Datei-Kommentar). */
export function registerUmzugTools(server: McpServer): void {
  server.registerTool(
    'familie_umziehen',
    {
      title: 'Familie umziehen (SCHREIBT)',
      description:
        'Benennt eine QUELLDATEI um und/oder verschiebt sie MIT ihrer Twin-Familie — in fester ' +
        'Reihenfolge: Import (Handkorrekturen retten) → Siblings → Quelle → MongoDB nachziehen → ' +
        'alter Spiegel weg → Export am neuen Ort. Dateien ohne Twin-Familie (z. B. Sync-Reste, ' +
        'Befund datei_ohne_endung) werden einfach umbenannt/verschoben. NIE Dateien direkt im ' +
        'Dateisystem anfassen — sonst zeigen die Mongo-Dokumente ins Leere. SCHREIBT in Storage ' +
        'und MongoDB; nur nach Bestaetigung durch den Menschen ausfuehren.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der Quelldatei (targetId aus Befunden / sourceId aus Familien)'),
        quellPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelldatei'),
        neuerName: z.string().min(1).optional().describe('Neuer Dateiname INKL. Endung'),
        neuerOrdnerId: z.string().min(1).optional().describe('Ziel-Ordner-Id (aus der Ordnerliste von abdeckung_lesen)'),
        neuerOrdnerPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad des Ziel-Ordners'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, quellPfad, neuerName, neuerOrdnerId, neuerOrdnerPfad }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const resolvedSourceId = await resolveSourceId(provider, sourceId, quellPfad)
        const newParentId = await resolveTargetFolder(provider, neuerOrdnerId, neuerOrdnerPfad)
        if (!neuerName && !newParentId) {
          throw new Error('neuerName und/oder ein Ziel-Ordner (neuerOrdnerId/neuerOrdnerPfad) ist Pflicht')
        }
        const result = await moveFamily({
          library, libraryId, userEmail, provider,
          sourceId: resolvedSourceId, newName: neuerName, newParentId,
        })
        return jsonResult({
          ok: true,
          result,
          hinweis: 'Danach abdeckung_scannen (Teilbaum), damit der Report den neuen Stand zeigt.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

}
