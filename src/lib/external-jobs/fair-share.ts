/**
 * @fileoverview Gerechte Platzvergabe des Job-Workers je Library.
 *
 * @description
 * Der Worker hat eine feste Zahl Plaetze (`JOBS_WORKER_CONCURRENCY`). Frueher
 * bekam ein freier Platz immer den Job, der am laengsten wartet — egal aus
 * welcher Library. Startete jemand 2000 Transkriptionen, stand jeder spaetere
 * Auftrag einer anderen Library hinter allen 2000 (Befund 20.11.2026).
 *
 * Neue Regel, wenn ein Platz frei wird:
 * 1. Die Library mit den WENIGSTEN laufenden Jobs bekommt ihn.
 * 2. Bei Gleichstand die Library, deren aeltester wartender Job am laengsten wartet.
 * 3. Danach entscheidet die libraryId (stabile, testbare Reihenfolge).
 * Innerhalb einer Library bleibt es beim aeltesten wartenden Job.
 *
 * Folge: Ist eine Library allein, bekommt sie alle Plaetze. Kommt eine zweite
 * dazu, geht jeder frei werdende Platz an die, die weniger belegt, bis beide
 * gleich viele haben. Laufende Jobs werden nie abgebrochen.
 *
 * Jobs ohne `libraryId` (Typ verlangt das Feld; Altbestand denkbar) bilden die
 * eigene Gruppe `null` — sie werden ausdruecklich mitverteilt, nicht verworfen.
 *
 * @module external-jobs
 */

/** Schluessel einer Library-Gruppe; `null` = Jobs ohne libraryId. */
export type LibraryKey = string | null

/** Der aelteste wartende Job einer Library (aus der Gruppierung in MongoDB). */
export interface QueuedLibraryHead {
  libraryId: LibraryKey
  /** jobId des aeltesten wartenden Jobs dieser Library. */
  jobId: string
  /** `updatedAt` dieses Jobs — so lange wartet die Library schon. */
  oldestQueuedAt: Date
}

/** Zahl laufender Jobs einer Library im eigenen Worker-Pool. */
export interface RunningLibraryCount {
  libraryId: LibraryKey
  running: number
}

/**
 * Normalisiert den Gruppenschluessel aus MongoDB (`$group: { _id: '$libraryId' }`).
 * Fehlendes Feld und `null` landen beide in der Gruppe `null`.
 *
 * Ein Nicht-String ist ein Datenfehler: Er wird ueber `onInvalid` laut gemeldet
 * und als `String(raw)` weiterverteilt. Werfen wuerde hier den ganzen Pool
 * anhalten — ein kaputter Job blockierte dann alle Libraries. Den Job selbst
 * holt der Aufrufer ueber die jobId, nicht ueber diesen Schluessel.
 */
export function toLibraryKey(raw: unknown, onInvalid: (raw: unknown) => void): LibraryKey {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') return raw
  onInvalid(raw)
  return String(raw)
}

function compareKeys(a: LibraryKey, b: LibraryKey): number {
  // `null` (ohne Library) sortiert hinter jede echte Library — nur fuer den
  // letzten Gleichstand relevant, damit die Reihenfolge stabil ist.
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

/**
 * Waehlt die Library, die den naechsten freien Platz bekommt.
 *
 * @param heads   je Library mit wartenden Jobs: deren aeltester wartender Job
 * @param running laufende Jobs je Library (Libraries ohne Eintrag zaehlen 0)
 * @returns den Kopf der gewaehlten Library, oder `null`, wenn niemand wartet
 */
export function pickNextLibrary(
  heads: readonly QueuedLibraryHead[],
  running: readonly RunningLibraryCount[],
): QueuedLibraryHead | null {
  if (heads.length === 0) return null

  const runningByLibrary = new Map<LibraryKey, number>()
  for (const r of running) {
    runningByLibrary.set(r.libraryId, (runningByLibrary.get(r.libraryId) ?? 0) + r.running)
  }

  const sorted = [...heads].sort((a, b) => {
    const runA = runningByLibrary.get(a.libraryId) ?? 0
    const runB = runningByLibrary.get(b.libraryId) ?? 0
    if (runA !== runB) return runA - runB
    const waitA = a.oldestQueuedAt.getTime()
    const waitB = b.oldestQueuedAt.getTime()
    if (waitA !== waitB) return waitA - waitB
    return compareKeys(a.libraryId, b.libraryId)
  })
  return sorted[0]
}
