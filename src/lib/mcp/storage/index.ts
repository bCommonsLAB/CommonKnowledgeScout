/**
 * @fileoverview Registrierung der Storage-Werkzeuge (Welle ST2).
 *
 * @description
 * Die generische Storage-Schicht der Bruecke: ein Zugang fuer OneDrive,
 * Nextcloud und Filesystem, ueber `StorageProvider` statt ueber ein
 * Backend. Was NICHT hierher gehoert (Twin-Familien, Bearbeitungsstand,
 * Befunde, Templates), steht in `docs/concepts/mcp-storage-anforderungen.md`
 * §4 — die Fachwerkzeuge RUFEN diese Schicht, sie bilden sie nicht nach.
 *
 * @module mcp/storage
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerStorageLeseTools } from './tools-datei'
import { registerStorageAnlegenTools } from './tools-anlegen'
import { registerStorageBinaerTools } from './tools-binaer'
import { registerStorageInfoLoeschenTools } from './tools-info-loeschen'
import { registerStorageOrdnerTools } from './tools-ordner'
import { registerStoragePatchTool } from './tools-patch'
import { registerStorageSchreibTools } from './tools-schreiben'
import { registerStorageVerschiebenTool } from './tools-verschieben'

/** Registriert alle Storage-Werkzeuge auf dem MCP-Server. */
export function registerStorageTools(server: McpServer): void {
  registerStorageOrdnerTools(server)
  registerStorageLeseTools(server)
  registerStorageSchreibTools(server)
  registerStoragePatchTool(server)
  registerStorageAnlegenTools(server)
  registerStorageBinaerTools(server)
  registerStorageVerschiebenTool(server)
  registerStorageInfoLoeschenTools(server)
}
