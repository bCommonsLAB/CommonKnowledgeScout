/**
 * @fileoverview Begrenzt-nebenlaeufiges Mapping (Worker-Pool).
 *
 * @description
 * Fuehrt `fn` ueber `items` mit fester maximaler Parallelitaet aus und liefert die
 * Ergebnisse IN ORIGINAL-REIHENFOLGE. Bewusst KEIN unbegrenztes `Promise.all`: bei
 * Storage-Backends (z.B. Nextcloud/WebDAV) wuerde das schnell ins Rate-Limit (429)
 * laufen. Ein Worker-Pool haelt die Anzahl gleichzeitiger Calls konstant niedrig.
 */

/**
 * Mappt `items` mit begrenzter Nebenlaeufigkeit und gibt die Ergebnisse in der
 * urspruenglichen Reihenfolge zurueck.
 *
 * @param items  Eingabeliste
 * @param limit  Maximale Anzahl gleichzeitig laufender `fn`-Aufrufe (>= 1)
 * @param fn     Pro Element auszufuehrende async-Funktion (erhaelt Element + Index)
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  if (items.length === 0) return results
  let cursor = 0
  const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length))
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index] as T, index)
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
