/**
 * @fileoverview Gemeinsame Bausteine der MCP-Werkzeuge (Welle 5).
 *
 * @description
 * Ergebnis-/Fehlerformat, Bruecken-User, Library-Zugriffspruefung und die
 * Teilbaum-Scope-Aufloesung (folderId ODER pfad) — geteilt von `tools.ts`
 * (Lesen/Sync) und `tools-umzug.ts` (Familien-Umzug). Fehler werden als
 * `isError`-Ergebnis gemeldet (Klartext), nie verschluckt.
 *
 * @module mcp
 */

import { z } from 'zod'
import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { resolveFolderIdByPath } from './resolve-folder'

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
  [key: string]: unknown
}

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error)
  FileLogger.error('mcp-tools', 'Werkzeug fehlgeschlagen', { error: message })
  return { content: [{ type: 'text', text: `Fehler: ${message}` }], isError: true }
}

/** User der Bruecke (Pilot: EIN Key ↔ EIN User, siehe `auth.ts`). */
export function mcpUserEmail(): string {
  const email = process.env.MCP_USER_EMAIL?.trim() ?? ''
  if (email === '') throw new Error('MCP_USER_EMAIL nicht konfiguriert')
  return email
}

export async function requireLibrary(userEmail: string, libraryId: string): Promise<Library> {
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Bibliothek nicht gefunden oder kein Zugriff: ${libraryId}`)
  return library
}

export async function requireProvider(userEmail: string, libraryId: string): Promise<StorageProvider> {
  const provider = await getServerProvider(userEmail, libraryId)
  if (!provider) throw new Error('Storage-Provider nicht verfuegbar')
  return provider
}

export const LIBRARY_ID = z.string().min(1).describe('Id der Library (aus bibliotheken_auflisten)')
export const FOLDER_ID = z
  .string()
  .min(1)
  .optional()
  .describe('Storage-Ordner-Id fuer einen Teilbaum (aus der Ordnerliste von abdeckung_lesen)')
export const SCOPE_PFAD = z
  .string()
  .min(1)
  .optional()
  .describe('ALTERNATIVE zu folderId: library-relativer Ordnerpfad (z. B. "26.01 Klima/Berichte") — wird direkt gegen den Storage aufgeloest, braucht KEINEN Report')

/**
 * Teilbaum-Scope aufloesen: folderId direkt, oder pfad billig gegen den
 * Storage (ein Listing pro Segment) — funktioniert auch ohne Report.
 */
export async function resolveScope(args: {
  userEmail: string
  libraryId: string
  folderId?: string
  pfad?: string
}): Promise<string | undefined> {
  if (args.folderId && args.pfad) {
    throw new Error('Entweder folderId ODER pfad angeben — nicht beides')
  }
  if (!args.pfad) return args.folderId
  const provider = await requireProvider(args.userEmail, args.libraryId)
  return resolveFolderIdByPath(provider, args.pfad)
}
