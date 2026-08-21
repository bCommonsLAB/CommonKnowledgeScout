/**
 * @fileoverview Ordner-Werkzeuge der MCP-Bruecke (Welle 5).
 *
 * @description
 * `ordner_erstellen` und `ordner_umbenennen` — Storage-only, mit den
 * Twin-Schutzregeln (Contract §2, Nachzug zum Verschachtelungs-Befund
 * 2026-08-21): `_`-Twin-Ordner werden NIE umbenannt (ihr Name ist an die
 * Quelle gebunden), NIE als Eltern-Ordner benutzt, und kein neuer
 * Ordner darf wie ein Twin-Ordner aussehen — Twin-Ordner legt nur die
 * Plattform selbst an.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin-folder-name'
import { resolveFolderIdByPath, resolveItemByPath } from './resolve-folder'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

function assertKeinTwinOrdnerName(name: string, kontext: string): void {
  if (isShadowTwinFolderName(name)) {
    throw new Error(
      `"${name}" ist ein Twin-Ordner-Name (\`_\`-Praefix) — ${kontext}. ` +
        'Twin-Ordner verwaltet ausschliesslich die Plattform (familie_umziehen/Export).',
    )
  }
}

/** Registriert die Ordner-Werkzeuge (siehe Datei-Kommentar). */
export function registerOrdnerTools(server: McpServer): void {
  server.registerTool(
    'ordner_erstellen',
    {
      title: 'Ordner erstellen (SCHREIBT)',
      description:
        'Legt einen neuen Ordner an (z. B. als Umzugsziel fuer familie_umziehen). Twin-`_`-Ordner ' +
        'sind weder als Eltern-Ordner noch als Name erlaubt. SCHREIBT im Storage; nur nach ' +
        'Bestaetigung durch den Menschen ausfuehren.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        elternOrdnerId: z.string().min(1).optional().describe('Id des Eltern-Ordners; weglassen + kein elternPfad = Library-Wurzel'),
        elternPfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad des Eltern-Ordners'),
        name: z.string().min(1).describe('Name des neuen Ordners'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ libraryId, elternOrdnerId, elternPfad, name }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        if (elternOrdnerId && elternPfad) throw new Error('Entweder elternOrdnerId ODER elternPfad — nicht beides')
        assertKeinTwinOrdnerName(name, 'neue Ordner duerfen nicht wie Twin-Ordner aussehen')
        const parentId = elternPfad ? await resolveFolderIdByPath(provider, elternPfad) : elternOrdnerId ?? 'root'
        if (parentId !== 'root') {
          const parent = await provider.getItemById(parentId).catch(() => null)
          if (!parent || parent.type !== 'folder') throw new Error(`${parentId} ist kein existierender Ordner`)
          assertKeinTwinOrdnerName(parent.metadata.name, 'in Twin-Ordnern werden keine Unterordner angelegt')
        }
        const folder = await provider.createFolder(parentId, name)
        return jsonResult({ ok: true, folderId: folder.id, name: folder.metadata.name, elternOrdnerId: parentId })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'ordner_umbenennen',
    {
      title: 'Ordner umbenennen (SCHREIBT)',
      description:
        'Benennt einen ORDNER um (Storage-only). Fuer MongoDB transparent: Provider-Ids bleiben ' +
        'stabil, Twin-`_`-Ordner wandern mit ihrem Ordner mit; der naechste Scan zeigt die neuen ' +
        'Pfade. Twin-`_`-Ordner selbst werden NIE umbenannt (Name ist an die Quelle gebunden — ' +
        'dafuer familie_umziehen). SCHREIBT im Storage; nur nach Bestaetigung ausfuehren.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        folderId: z.string().min(1).optional().describe('Ordner-Id (aus der Ordnerliste von abdeckung_lesen)'),
        pfad: z.string().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad des Ordners'),
        neuerName: z.string().min(1).describe('Neuer Ordnername'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, folderId, pfad, neuerName }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const provider = await requireProvider(userEmail, libraryId)
        if (folderId && pfad) throw new Error('Entweder folderId ODER pfad angeben — nicht beides')
        let id = folderId
        let alterName = ''
        if (!id) {
          if (!pfad) throw new Error('folderId oder pfad ist Pflicht')
          const item = await resolveItemByPath(provider, pfad, 'folder')
          id = item.id
          alterName = item.name
        } else {
          const item = await provider.getItemById(id)
          if (!item || item.type !== 'folder') throw new Error(`${id} ist kein Ordner`)
          alterName = item.metadata.name
        }
        if (id === 'root') throw new Error('Die Library-Wurzel wird nicht umbenannt')
        assertKeinTwinOrdnerName(alterName, 'Twin-Ordner werden nie umbenannt — ihr Name gehoert zur Quelle (familie_umziehen)')
        assertKeinTwinOrdnerName(neuerName, 'normale Ordner duerfen nicht zu Twin-Ordner-Namen werden')
        if (alterName === neuerName) throw new Error('Neuer Name ist identisch mit dem Ist-Zustand')
        await provider.renameItem(id, neuerName)
        return jsonResult({
          ok: true, folderId: id, alterName, neuerName,
          hinweis: 'Danach abdeckung_scannen (Teilbaum), damit der Report die neuen Pfade zeigt.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
