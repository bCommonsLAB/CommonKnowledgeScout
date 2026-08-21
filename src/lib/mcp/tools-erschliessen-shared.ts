/**
 * @fileoverview Gemeinsame Bausteine der Erschliessungs-Werkzeuge (Welle 5).
 *
 * @description
 * Quell-Aufloesung (einzeln UND als Stapel, Pilot-Wunschliste C3),
 * Standard-Template-Zwang und das Stapel-Ergebnisformat. Aus
 * `tools-erschliessen.ts` ausgelagert (200-Zeilen-Regel).
 *
 * Stapel-Semantik: Fehler EINER Quelle brechen den Stapel nicht ab —
 * jede Zeile traegt ihr eigenes Ergebnis (jobId ODER fehler), damit der
 * Agent gezielt nachfassen kann statt blind neu zu starten.
 *
 * @module mcp
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { resolveItemByPath } from './resolve-folder'

export const JOB_HINWEIS =
  'Job laeuft im Hintergrund (External-Jobs-Worker im KS-Server) — Status mit job_status abfragen; danach abdeckung_scannen (Teilbaum).'

export interface ResolvedSource {
  itemId: string
  parentId: string
  name: string
  mimeType?: string
}

export async function resolveSourceItem(
  provider: StorageProvider,
  sourceId?: string,
  quellPfad?: string,
): Promise<ResolvedSource> {
  if (sourceId && quellPfad) throw new Error('Entweder sourceId ODER quellPfad angeben — nicht beides')
  if (quellPfad) {
    const item = await resolveItemByPath(provider, quellPfad, 'file')
    return { itemId: item.id, parentId: item.parentFolderId, name: item.name }
  }
  if (!sourceId) throw new Error('sourceId oder quellPfad ist Pflicht')
  const item = await provider.getItemById(sourceId)
  if (!item || item.type !== 'file') throw new Error(`${sourceId} ist keine Datei`)
  return { itemId: item.id, parentId: item.parentId, name: item.metadata.name }
}

export function standardTemplate(library: Library): string {
  const template = library.config?.secretaryService?.template?.trim() ?? ''
  if (template === '') {
    throw new Error(
      'Kein Standard-Template in der Library konfiguriert (Einstellungen → Secretary) — template explizit angeben',
    )
  }
  return template
}

/** Ergebnis-Zeile eines Stapels: gestartet ODER gescheitert, nie beides. */
export interface BatchRow {
  quelle: string
  jobId?: string
  fehler?: string
}

/**
 * Fuehrt `start` fuer jede Quelle des Aufrufs aus (einzeln via
 * sourceId/quellPfad oder Stapel via sourceIds) und sammelt die Ergebnisse.
 */
export async function runForSources(args: {
  provider: StorageProvider
  sourceId?: string
  quellPfad?: string
  sourceIds?: string[]
  start: (source: ResolvedSource) => Promise<string>
}): Promise<{ zeilen: BatchRow[]; gestartet: number; gescheitert: number }> {
  const { provider, sourceId, quellPfad, sourceIds, start } = args
  const hasSingle = Boolean(sourceId) || Boolean(quellPfad)
  const hasBatch = Array.isArray(sourceIds) && sourceIds.length > 0
  if (hasSingle && hasBatch) throw new Error('Entweder sourceId/quellPfad ODER sourceIds — nicht beides')
  if (!hasSingle && !hasBatch) throw new Error('sourceId, quellPfad oder sourceIds ist Pflicht')

  const zeilen: BatchRow[] = []
  const targets: Array<{ sourceId?: string; quellPfad?: string }> = hasBatch
    ? (sourceIds ?? []).map((id) => ({ sourceId: id }))
    : [{ sourceId, quellPfad }]

  for (const target of targets) {
    let name = target.sourceId ?? target.quellPfad ?? '(unbekannt)'
    try {
      const source = await resolveSourceItem(provider, target.sourceId, target.quellPfad)
      name = source.name
      const jobId = await start(source)
      zeilen.push({ quelle: name, jobId })
    } catch (error) {
      zeilen.push({ quelle: name, fehler: error instanceof Error ? error.message : String(error) })
    }
  }
  return {
    zeilen,
    gestartet: zeilen.filter((row) => row.jobId).length,
    gescheitert: zeilen.filter((row) => row.fehler).length,
  }
}
