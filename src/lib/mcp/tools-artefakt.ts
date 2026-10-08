/**
 * @fileoverview MCP-Werkzeug `artefakt_lesen` (Welle G).
 *
 * @description
 * Transkript oder Transformation einer Quelle aus MongoDB lesen, ohne
 * Spiegel — noetig, damit ein Agent die Zuordnung in Station 3 (welches
 * Audio gehoert zu welchen Folien) aus den Transkriptanfaengen ableiten
 * kann, auch bei persistToFilesystem=false. Nur lesen; Auswahl in
 * `artefakt-auswahl.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { artefaktUebersicht, waehleArtefakt } from './artefakt-auswahl'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'
import { resolveSourceItem } from './tools-erschliessen-shared'

const MAX_ZEICHEN_VORGABE = 60_000
const MAX_ZEICHEN_GRENZE = 400_000

export function registerArtefaktTool(server: McpServer): void {
  server.registerTool(
    'artefakt_lesen',
    {
      title: 'Transkript oder Transformation aus MongoDB lesen (liest nur)',
      description:
        'Liefert das Transkript (sprach-neutral) oder eine Transformation (sprache, optional vorlage) ' +
        'einer Quelle aus dem Twin-Dokument in MongoDB — ohne Spiegel, also auch in Libraries ohne ' +
        'Filesystem-Persistierung. Ohne vorlage gewinnt die juengste Transformation der Sprache, die ' +
        'Antwort nennt sie. Fehlt das Artefakt, nennt der Fehler, was es stattdessen gibt. Text ' +
        'standardmaessig ohne Frontmatter und auf maxZeichen gekuerzt (gekuerzt: true); lange Frontmatter-Felder ' +
        'auf min(maxZeichen, 1000) Zeichen (frontmatterGekuerzt nennt sie). Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der QUELLE (z. B. der .m4a)'),
        pfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad der Quelle'),
        art: z.enum(['transkript', 'transformation']).describe('Welches Artefakt'),
        sprache: z.string().min(2).max(5).optional().describe('Sprache der Transformation (Default de); beim Transkript ohne Bedeutung'),
        vorlage: z.string().min(1).optional().describe('Vorlage der Transformation; weglassen = juengste der Sprache'),
        ohneFrontmatter: z.boolean().optional().describe('Default true: nur der Body; false = ganzes Markdown'),
        maxZeichen: z.number().int().min(100).max(MAX_ZEICHEN_GRENZE).optional().describe(`Default ${MAX_ZEICHEN_VORGABE}`),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, sourceId, pfad, art, sprache, vorlage, ohneFrontmatter, maxZeichen }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        const source = await resolveSourceItem(provider, sourceId, pfad)
        const doc = (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [source.itemId] })).get(source.itemId)
        if (!doc) throw new Error(`Kein Twin in MongoDB fuer "${source.name}" — zuerst quelle_erschliessen`)
        const sicht = waehleArtefakt({
          doc, art, sprache: sprache ?? 'de', vorlage, ohneFrontmatter: ohneFrontmatter ?? true, maxZeichen: maxZeichen ?? MAX_ZEICHEN_VORGABE,
        })
        return jsonResult({ sourceId: source.itemId, quelle: source.name, ...sicht, vorhanden: artefaktUebersicht(doc) })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
