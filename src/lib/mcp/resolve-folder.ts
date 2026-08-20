/**
 * @fileoverview Pfad → folderId-Resolver fuer die MCP-Bruecke (Welle 5).
 *
 * @description
 * Loest einen library-relativen Ordnerpfad direkt gegen den Storage auf —
 * ein `listItemsById` pro Pfadsegment, also billig und timeout-fest. Damit
 * koennen Agenten `abdeckung_scannen`/`twins_pruefen` auch OHNE vorhandenen
 * Coverage-Report auf einen Teilbaum begrenzen (Henne-Ei-Befund aus dem
 * ersten Cowork-Pilot: ohne Report keine Ordnerliste, ohne Ordnerliste kein
 * Teilbaum-Scope).
 *
 * Kein Raten: exakter Namens-Match zuerst; sonst case-insensitiv nur bei
 * EINDEUTIGKEIT; sonst Fehler mit den vorhandenen Ordnernamen als Hinweis.
 *
 * @module mcp
 */

import type { StorageProvider } from '@/lib/storage/types'

/** Pfad nicht aufloesbar — die Meldung nennt Ebene und vorhandene Ordner. */
export class FolderPathNotFoundError extends Error {
  readonly code = 'folder_not_found' as const
}

const MAX_HINT_FOLDERS = 30

/**
 * Loest `pfad` (library-relativ, `/`-getrennt) auf die Storage-Ordner-Id auf.
 * Wirft {@link FolderPathNotFoundError} mit Klartext-Hinweis, wenn ein
 * Segment fehlt oder mehrdeutig ist.
 */
export async function resolveFolderIdByPath(provider: StorageProvider, path: string): Promise<string> {
  const segments = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
  if (segments.length === 0) {
    throw new FolderPathNotFoundError('Leerer Pfad — einen library-relativen Ordnerpfad angeben')
  }

  let currentId = 'root'
  const walked: string[] = []
  for (const segment of segments) {
    const items = await provider.listItemsById(currentId)
    const folders = items.filter((item) => item.type === 'folder')
    const exact = folders.find((folder) => folder.metadata.name === segment)
    let match = exact
    if (!match) {
      const caseInsensitive = folders.filter(
        (folder) => folder.metadata.name.toLowerCase() === segment.toLowerCase(),
      )
      if (caseInsensitive.length === 1) match = caseInsensitive[0]
      else if (caseInsensitive.length > 1) {
        throw new FolderPathNotFoundError(
          `Ordnername "${segment}" ist unter "${walked.join('/') || '(Wurzel)'}" mehrdeutig ` +
            `(${caseInsensitive.map((folder) => folder.metadata.name).join(', ')}) — exakte Schreibweise angeben`,
        )
      }
    }
    if (!match) {
      const available = folders.map((folder) => folder.metadata.name)
      const hint = available.slice(0, MAX_HINT_FOLDERS).join(', ')
      const more = available.length > MAX_HINT_FOLDERS ? ` … (+${available.length - MAX_HINT_FOLDERS} weitere)` : ''
      throw new FolderPathNotFoundError(
        `Ordner "${segment}" nicht gefunden unter "${walked.join('/') || '(Wurzel)'}". ` +
          `Vorhandene Ordner: ${hint || '(keine)'}${more}`,
      )
    }
    currentId = match.id
    walked.push(match.metadata.name)
  }
  return currentId
}
