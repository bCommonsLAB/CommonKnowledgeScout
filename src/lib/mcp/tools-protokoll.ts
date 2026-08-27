/**
 * @fileoverview Werkzeug `protokoll_lesen` — das Gedaechtnis eines Vorhabens.
 *
 * @description
 * Gegenstueck zur Begruendungs-Pflicht (`protokoll.ts`): Was jede schreibende
 * Aktion an WARUM hinterlaesst, ist hier abrufbar. Damit braucht es keine
 * handgepflegte Protokoll-Datei im Archiv mehr — die Buchhaltung steht in der
 * Datenbank, der Vault traegt nur noch, was Menschen lesen.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { leseAktionsProtokoll } from '@/lib/repositories/aktions-protokoll-repo'
import { FOLDER_ID, LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

export function registerProtokollTool(server: McpServer): void {
  server.registerTool(
    'protokoll_lesen',
    {
      title: 'Aktions-Protokoll lesen (WARUM lief was)',
      description:
        'Liest das Aktions-Protokoll: jede schreibende Aktion ueber die Bruecke mit ihrer ' +
        'BEGRUENDUNG, juengste zuerst. Ersetzt handgepflegte Protokoll-Dateien im Archiv — ' +
        'Job-Historie und Befunde fuehrt KnowledgeScout ohnehin, hier steht das WARUM daneben. ' +
        'Ohne folderId: die ganze Library. Liest nur, schreibt nichts.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        folderId: FOLDER_ID,
        limit: z.number().int().min(1).max(200).optional()
          .describe('Wie viele Eintraege (Default 50, Maximum 200)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, folderId, limit }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const eintraege = await leseAktionsProtokoll({ libraryId, folderId, limit })
        return jsonResult({
          eintraege,
          anzahl: eintraege.length,
          hinweis:
            eintraege.length === 0
              ? 'Noch kein Protokoll — es entsteht erst mit schreibenden Aktionen ueber die Bruecke (ab Werkzeugsatz 2.6.0).'
              : 'Juengste zuerst. Fehlversuche stehen mit status "fehler" drin — auch sie sind Geschichte.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
