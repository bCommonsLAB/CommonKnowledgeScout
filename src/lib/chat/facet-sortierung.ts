/**
 * Reihenfolge der Werte eines Galerie-Filters (Owner 10.11.2026).
 *
 * Je Facette legt die Library fest, WONACH sortiert wird (`sort`: `alpha` =
 * nach Wert, `count` = nach Häufigkeit), in welcher RICHTUNG (`sortDirection`:
 * `asc` | `desc`) und wie viele Werte höchstens erscheinen (`max`). Ohne
 * Richtung gilt die gewohnte: Werte aufsteigend, Häufigkeit absteigend
 * (häufigste zuerst). So steht z. B. bei `year` mit `alpha` + `desc` der
 * jüngste Jahrgang oben.
 *
 * Vor dieser Datei standen `sort`, `max` und `columns` zwar in der
 * Verwaltungsmaske, das Server-Schema (`config.ts`) kannte sie aber nicht —
 * Zod verwarf sie, die Galerie sortierte jeden Filter aufsteigend nach Wert.
 *
 * Reine Funktionen, keine Seiteneffekte; die Maske führt beide Angaben als
 * EINE Auswahl (`SORTIER_WAHLEN`).
 */

export type FacetSort = 'alpha' | 'count'
export type FacetSortDirection = 'asc' | 'desc'

export const FACET_SORTS: readonly FacetSort[] = ['alpha', 'count']
export const FACET_SORT_DIRECTIONS: readonly FacetSortDirection[] = ['asc', 'desc']

export interface FacetSortierung {
  /** Facetten-Typ: `number` vergleicht Werte als Zahlen. */
  type?: string
  sort?: FacetSort
  sortDirection?: FacetSortDirection
  max?: number
}

export interface FacetWertZahl {
  value: string | number
  count: number
}

/** Die Richtung, die gilt, wenn keine gesetzt ist: Werte aufsteigend, Häufigkeit absteigend. */
export function standardRichtung(sort: FacetSort): FacetSortDirection {
  return sort === 'count' ? 'desc' : 'asc'
}

function vergleicheWerte(a: string | number, b: string | number, alsZahl: boolean): number {
  if (alsZahl) {
    const x = Number(a)
    const y = Number(b)
    if (Number.isFinite(x) && Number.isFinite(y)) return x - y
  }
  return String(a).localeCompare(String(b))
}

/**
 * Sortiert die Werte einer Facette und kappt sie auf `max`. Bei gleicher
 * Häufigkeit entscheidet der Wert aufsteigend — unabhängig von der Richtung,
 * damit die Reihenfolge stabil bleibt.
 */
export function sortiereFacettenWerte<T extends FacetWertZahl>(werte: ReadonlyArray<T>, s: FacetSortierung): T[] {
  const sort: FacetSort = s.sort ?? 'alpha'
  const richtung = s.sortDirection ?? standardRichtung(sort)
  const faktor = richtung === 'desc' ? -1 : 1
  const alsZahl = s.type === 'number'
  const sortiert = werte.slice().sort((a, b) =>
    sort === 'count'
      ? faktor * (a.count - b.count) || vergleicheWerte(a.value, b.value, alsZahl)
      : faktor * vergleicheWerte(a.value, b.value, alsZahl),
  )
  return typeof s.max === 'number' ? sortiert.slice(0, s.max) : sortiert
}

/** Die vier Kombinationen als EINE Auswahl der Verwaltungsmaske. */
export interface SortierWahl {
  wert: string
  sort: FacetSort
  sortDirection: FacetSortDirection
  label: string
}

export const SORTIER_WAHLEN: readonly SortierWahl[] = [
  { wert: 'alpha:asc', sort: 'alpha', sortDirection: 'asc', label: 'Wert ↑ (A–Z, 1–9)' },
  { wert: 'alpha:desc', sort: 'alpha', sortDirection: 'desc', label: 'Wert ↓ (Z–A, 9–1)' },
  { wert: 'count:desc', sort: 'count', sortDirection: 'desc', label: 'Häufigste zuerst' },
  { wert: 'count:asc', sort: 'count', sortDirection: 'asc', label: 'Seltenste zuerst' },
]

/** Auswahlwert zu einer gespeicherten Sortierung (ohne Richtung: die gewohnte). */
export function sortierWahlWert(sort: FacetSort | undefined, richtung: FacetSortDirection | undefined): string {
  const s: FacetSort = sort ?? 'alpha'
  return `${s}:${richtung ?? standardRichtung(s)}`
}

/** Auswahlwert → Sortierung; ein unbekannter Wert wirft (kein stiller Rückfall). */
export function ausSortierWahl(wert: string): { sort: FacetSort; sortDirection: FacetSortDirection } {
  const wahl = SORTIER_WAHLEN.find((w) => w.wert === wert)
  if (!wahl) throw new Error(`Unbekannte Sortierung „${wert}" — erlaubt: ${SORTIER_WAHLEN.map((w) => w.wert).join(', ')}`)
  return { sort: wahl.sort, sortDirection: wahl.sortDirection }
}
