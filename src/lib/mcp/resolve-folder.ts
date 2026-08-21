/**
 * @fileoverview Pfad-Resolver der MCP-Bruecke (Welle 5): Pfad → Storage-Item.
 *
 * @description
 * Loest einen library-relativen Pfad direkt gegen den Storage auf — ein
 * `listItemsById` pro Pfadsegment, also billig und timeout-fest. Damit
 * koennen Agenten Teilbaum-Scope (`abdeckung_scannen`/`twins_pruefen`) und
 * Umzugsziele (`familie_umziehen`) auch OHNE vorhandenen Coverage-Report
 * adressieren (Henne-Ei-Befund aus dem ersten Cowork-Pilot).
 *
 * Kein Raten: exakter Namens-Match zuerst; sonst case-insensitiv nur bei
 * EINDEUTIGKEIT; sonst Fehler mit den vorhandenen Namen als Hinweis.
 * Zwischensegmente muessen Ordner sein; fuer das LETZTE Segment sagt der
 * Aufrufer, ob er eine Datei oder einen Ordner erwartet (kein Raten bei
 * Namensgleichheit von Datei und Ordner).
 *
 * @module mcp
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'

/** Pfad nicht aufloesbar — die Meldung nennt Ebene und vorhandene Namen. */
export class FolderPathNotFoundError extends Error {
  readonly code = 'folder_not_found' as const
}

const MAX_HINT_ITEMS = 30

/** Aufgeloestes Storage-Item (letztes Pfadsegment darf Datei ODER Ordner sein). */
export interface ResolvedPathItem {
  id: string
  type: 'file' | 'folder'
  name: string
  parentFolderId: string
}

/** Findet das Segment; `null` = nicht da (Retry-Kandidat), wirft nur bei Mehrdeutigkeit. */
function findSegment(candidates: StorageItem[], segment: string, walked: string[]): StorageItem | null {
  const exact = candidates.find((item) => item.metadata.name === segment)
  if (exact) return exact
  const caseInsensitive = candidates.filter(
    (item) => item.metadata.name.toLowerCase() === segment.toLowerCase(),
  )
  if (caseInsensitive.length === 1) return caseInsensitive[0]
  if (caseInsensitive.length > 1) {
    throw new FolderPathNotFoundError(
      `"${segment}" ist unter "${walked.join('/') || '(Wurzel)'}" mehrdeutig ` +
        `(${caseInsensitive.map((item) => item.metadata.name).join(', ')}) — exakte Schreibweise angeben`,
    )
  }
  return null
}

function notFoundError(candidates: StorageItem[], segment: string, walked: string[]): FolderPathNotFoundError {
  const available = candidates.map((item) => item.metadata.name)
  const hint = available.slice(0, MAX_HINT_ITEMS).join(', ')
  const more = available.length > MAX_HINT_ITEMS ? ` … (+${available.length - MAX_HINT_ITEMS} weitere)` : ''
  return new FolderPathNotFoundError(
    `"${segment}" auch nach Wartezeit nicht gefunden unter "${walked.join('/') || '(Wurzel)'}". ` +
      `Vorhanden: ${hint || '(nichts)'}${more}`,
  )
}

/**
 * Pilot-Wunschliste B6: Frisch angelegte Items sind fuer die OneDrive-API
 * teils erst nach ~45 s sichtbar. Fehlt ein Segment, wird die Ebene nach
 * kurzen Wartezeiten neu gelistet, bevor der Resolver aufgibt — Mehrdeutigkeit
 * wirft sofort (Warten macht sie nicht eindeutig).
 */
const SEGMENT_RETRY_DELAYS_MS = [3000, 5000]

/**
 * Loest `pfad` auf ein Storage-Item der erwarteten Art auf (siehe
 * Datei-Kommentar). Wirft {@link FolderPathNotFoundError} mit
 * Klartext-Hinweis, wenn ein Segment fehlt oder mehrdeutig ist.
 */
export async function resolveItemByPath(
  provider: StorageProvider,
  path: string,
  expectedKind: 'file' | 'folder',
  /** Testbar: Wartezeiten der Segment-Retries (Default {@link SEGMENT_RETRY_DELAYS_MS}). */
  retryDelaysMs?: readonly number[],
): Promise<ResolvedPathItem> {
  const segments = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
  if (segments.length === 0) {
    throw new FolderPathNotFoundError('Leerer Pfad — einen library-relativen Pfad angeben')
  }

  const retryDelays = retryDelaysMs ?? SEGMENT_RETRY_DELAYS_MS
  let currentId = 'root'
  const walked: string[] = []
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    const isLast = index === segments.length - 1
    let match: StorageItem | null = null
    let candidates: StorageItem[] = []
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt - 1]))
      const items = await provider.listItemsById(currentId)
      // Zwischensegmente: nur Ordner; letztes Segment: die erwartete Art.
      candidates = items.filter((item) => item.type === (isLast ? expectedKind : 'folder'))
      match = findSegment(candidates, segment, walked)
      if (match) break
    }
    if (!match) throw notFoundError(candidates, segment, walked)
    if (isLast) {
      return {
        id: match.id,
        type: match.type === 'folder' ? 'folder' : 'file',
        name: match.metadata.name,
        parentFolderId: currentId,
      }
    }
    currentId = match.id
    walked.push(match.metadata.name)
  }
  /* istanbul ignore next -- Schleife endet immer mit return/throw */
  throw new FolderPathNotFoundError('Pfad nicht aufloesbar')
}

/** Loest `pfad` auf eine Ordner-Id auf. */
export async function resolveFolderIdByPath(
  provider: StorageProvider,
  path: string,
  retryDelaysMs?: readonly number[],
): Promise<string> {
  return (await resolveItemByPath(provider, path, 'folder', retryDelaysMs)).id
}
