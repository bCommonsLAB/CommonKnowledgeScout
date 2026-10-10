/**
 * @fileoverview Spiegel-Datei nach einer Transkript-Korrektur verzoegert nachziehen.
 *
 * @description
 * MongoDB ist die fuehrende Fassung (Shadow Twin Mongo-only). Die Korrektur-
 * Ansicht speichert jeden Satz sofort; der Spiegel im Storage (Nextcloud,
 * ganze Datei per WebDAV) muss nicht bei jedem Satz mitgeschrieben werden —
 * das war der traege Teil jedes Speicherns (Owner-Befund 10.10.2026). Statt
 * dessen: synchron nur Mongo, und je Quelle ein Export, der erst
 * `SPIEGEL_VERZOEGERUNG_MS` nach der LETZTEN Aenderung laeuft (derselbe Weg wie
 * `twins_synchronisieren export`). Stirbt der Prozess vorher, traegt Mongo die
 * Korrektur trotzdem; der naechste Export zieht nach. Fehler stehen im Log,
 * nie still.
 *
 * In-Prozess-Timer: tragfaehig fuer den Node-Betrieb (Docker, ein Prozess);
 * bei mehreren Instanzen laeuft der Export je Instanz, was harmlos ist
 * (idempotent).
 *
 * @module transkript-korrektur
 */

import { FileLogger } from '@/lib/debug/logger'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'

export const SPIEGEL_VERZOEGERUNG_MS = 5_000

const timer = new Map<string, ReturnType<typeof setTimeout>>()

export interface SpiegelExportArgs {
  libraryId: string
  userEmail: string
  sourceId: string
  /** Tests: eigene Verzoegerung bzw. eigener Export. */
  verzoegerungMs?: number
  exportieren?: (args: { libraryId: string; userEmail: string; sourceId: string }) => Promise<unknown>
}

async function standardExport(args: { libraryId: string; userEmail: string; sourceId: string }): Promise<unknown> {
  return runLibrarySync({ libraryId: args.libraryId, userEmail: args.userEmail, mode: 'repair', preset: 'export', scope: { sourceIds: [args.sourceId] } })
}

/** Export fuer die Quelle einplanen; eine weitere Aenderung verschiebt ihn nach hinten. */
export function planeSpiegelExport(args: SpiegelExportArgs): void {
  const key = `${args.libraryId}::${args.sourceId}`
  const alt = timer.get(key)
  if (alt) clearTimeout(alt)
  const exportieren = args.exportieren ?? standardExport
  const t = setTimeout(() => {
    timer.delete(key)
    exportieren({ libraryId: args.libraryId, userEmail: args.userEmail, sourceId: args.sourceId })
      .then(() => FileLogger.info('transcript-correction', 'Spiegel nachgezogen', { libraryId: args.libraryId, sourceId: args.sourceId }))
      .catch((error: unknown) => FileLogger.error('transcript-correction', 'Spiegel NICHT nachgezogen — MongoDB traegt die Korrektur; Export spaeter wiederholen', {
        libraryId: args.libraryId, sourceId: args.sourceId, error: error instanceof Error ? error.message : String(error),
      }))
  }, args.verzoegerungMs ?? SPIEGEL_VERZOEGERUNG_MS)
  // Der Timer soll einen Node-Prozess nicht am Beenden hindern.
  if (typeof t === 'object' && t && 'unref' in t) (t as { unref: () => void }).unref()
  timer.set(key, t)
}

/** Fuer Tests: ist fuer die Quelle ein Export offen? */
export function spiegelExportOffen(libraryId: string, sourceId: string): boolean {
  return timer.has(`${libraryId}::${sourceId}`)
}
