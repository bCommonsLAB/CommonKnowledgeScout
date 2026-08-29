/**
 * @fileoverview Ordner-Listings der Sync-Engine parallel holen — mit fester
 * Reihenfolge.
 *
 * @description
 * Befund 29.08.2026 (Prod): Der Coverage-Scan der Agentensicht kam nicht mehr
 * durch. Ursache war nicht die Dateimenge, sondern der Storage-Walk der
 * Sync-Engine (`resolve-sources.ts`): eine `while`-Schleife, die Ordner EINZELN
 * nacheinander listet. Der Nachbar-Walk `archive-scan.ts` wurde in W1/W8 genau
 * deshalb parallelisiert (dort gemessen: 369 Ordner seriell = 80 s auf
 * OneDrive, also ~0,22 s je Listing) — der Engine-Walk blieb seriell und ist
 * bei 1.129 Ordnern mit rund vier Minuten der teuerste Posten des Scans.
 *
 * REIHENFOLGE IST TEIL DES VERTRAGS. `archive-scan.ts` durfte die Reihenfolge
 * antwortzeitabhaengig machen, weil sein einziger Konsument danach sortiert.
 * Hier ist das nicht so: aus dem Walk faellt die Quellen-Liste, und an ihr
 * haengen Plan und Report. Deshalb liefert diese Funktion die Ergebnisse
 * INDIZIERT nach Eingabe zurueck — der Aufrufer arbeitet sie in Eingabe-
 * Reihenfolge ab und bekommt Ordner fuer Ordner dasselbe Ergebnis wie die
 * serielle Schleife. Parallel ist nur das Warten auf den Storage.
 *
 * @module shadow-twin/sync-engine
 */

import type { StorageItem } from '@/lib/storage/types'

/**
 * Gleichzeitige Ordner-Listings. Wie `COVERAGE_SCAN_CONCURRENCY` im
 * Archiv-Walk: hoch genug, damit die Wartezeit verschwindet, niedrig genug,
 * dass OneDrive nicht mit 429 drosselt (der Provider behandelt Retry-After
 * selbst, aber gedrosselte Aufrufe sind trotzdem verlorene Zeit).
 */
export const SYNC_SCAN_CONCURRENCY = 8

/**
 * Listet die Ordner nebenlaeufig und gibt die Ergebnisse in der Reihenfolge
 * der `folderIds` zurueck (`ergebnis[i]` gehoert zu `folderIds[i]`).
 *
 * Ein Fehler bricht wie bisher den ganzen Lauf ab — ein Ordner, der sich nicht
 * lesen laesst, macht die Quellen-Liste unvollstaendig, und eine
 * unvollstaendige Liste als vollstaendig auszugeben waere genau der stille
 * Fallback, den `no-silent-fallbacks` verbietet.
 */
export async function listFoldersParallel(args: {
  folderIds: readonly string[]
  list: (folderId: string) => Promise<StorageItem[]>
  concurrency?: number
}): Promise<StorageItem[][]> {
  const { folderIds, list } = args
  const ergebnisse: StorageItem[][] = new Array(folderIds.length)
  if (folderIds.length === 0) return ergebnisse

  const spuren = Math.max(1, Math.min(Math.floor(args.concurrency ?? SYNC_SCAN_CONCURRENCY), folderIds.length))
  let naechsterIndex = 0

  const spur = async (): Promise<void> => {
    for (;;) {
      const index = naechsterIndex
      naechsterIndex += 1
      if (index >= folderIds.length) return
      ergebnisse[index] = await list(folderIds[index])
    }
  }

  await Promise.all(Array.from({ length: spuren }, () => spur()))
  return ergebnisse
}
