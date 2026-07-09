'use client'

/**
 * use-gallery-sums — serverseitige Summen fuer die Tabellen-Fusszeile
 * (Plan summen-und-synergie-aggregation, Todo table-footer).
 *
 * Fragt `GET docs?aggregate=sums` mit EXAKT denselben Filter-/Such-Params wie
 * `use-gallery-data` an — die Summe gilt damit fuer den GESAMTEN gefilterten
 * Bestand, nicht nur fuer die per Scroll-Pagination geladenen Zeilen (eine
 * Client-Summe waere still falsch). Fehlende Werte kommen als `missing` pro
 * Feld zurueck und werden in der UI als "X ohne Angabe" gezeigt.
 */

import { useEffect, useMemo, useState } from 'react'

export interface GallerySumField {
  sum: number
  count: number
  missing: number
}

export interface GallerySumsState {
  /** Aggregat pro Summenfeld; null solange nichts geladen ist. */
  sums: Record<string, GallerySumField> | null
  /** Gesamtzahl der Dokumente im gefilterten Bestand. */
  total: number
  loading: boolean
  error: string | null
}

export function useGallerySums(
  filters: Record<string, string[] | undefined>,
  searchQuery: string,
  libraryId?: string,
  options?: {
    /** Nur fetchen, wenn die Tabellenansicht aktiv ist (Rules of Hooks). */
    enabled?: boolean
    /** Refresh nach Loeschen/Publish (gleicher Mechanismus wie die Liste). */
    refreshKey?: number
  },
): GallerySumsState {
  const enabled = options?.enabled ?? false
  const refreshKey = options?.refreshKey ?? 0

  const [state, setState] = useState<GallerySumsState>({
    sums: null,
    total: 0,
    loading: false,
    error: null,
  })

  // Stabiler Dependency-Schluessel (gleiches Muster wie use-gallery-data).
  const filtersString = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    if (!enabled || !libraryId) {
      setState({ sums: null, total: 0, loading: false, error: null })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function load(currentLibraryId: string) {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const params = new URLSearchParams()
        const parsedFilters = JSON.parse(filtersString) as Record<string, string[] | undefined>
        Object.entries(parsedFilters).forEach(([k, arr]) => {
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
        })
        if (searchQuery.trim()) params.append('search', searchQuery.trim())
        params.append('aggregate', 'sums')

        const res = await fetch(
          `/api/chat/${encodeURIComponent(currentLibraryId)}/docs?${params.toString()}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error(`Ungültige Antwort: ${res.status}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Summen')
        }
        if (cancelled) return
        const sums =
          data && typeof data === 'object' && data.sums && typeof data.sums === 'object'
            ? (data.sums as Record<string, GallerySumField>)
            : null
        if (!sums) throw new Error('Antwort ohne sums-Feld')
        setState({
          sums,
          total: typeof data.total === 'number' ? data.total : 0,
          loading: false,
          error: null,
        })
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        setState({
          sums: null,
          total: 0,
          loading: false,
          error: e instanceof Error ? e.message : 'Unbekannter Fehler',
        })
      }
    }

    load(libraryId)
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, libraryId, filtersString, searchQuery, refreshKey])

  return state
}
