'use client'

/**
 * use-all-gallery-docs — lädt für den Graph-Modus ALLE (gefilterten) Dokumente
 * einer Library batchweise über `/api/chat/[libraryId]/docs`.
 *
 * Hintergrund: Die Galerie lädt per Scroll-Pagination (5 Gruppen bzw. 50 Docs
 * pro Schritt, siehe use-gallery-data.ts). Der Graph braucht aber den GANZEN
 * gefilterten Bestand — sonst fehlen Knoten, ohne dass es sichtbar ist.
 * Dieser Hook ist bewusst von der Galerie-Pagination entkoppelt: Er läuft nur
 * bei aktivem Graph-Modus (`enabled`) und aktualisiert `docs` nach jedem
 * Batch — das treibt die Fortschrittsanzeige. Der Graph selbst wird vom
 * Aufrufer (gallery-root) erst gemountet, wenn `loading` false ist, damit
 * D3-Layout und Kanten-Berechnung genau EINMAL laufen (nicht pro Batch).
 */

import { useEffect, useMemo, useState } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'

/** Batch-Größe pro Request — muss unter dem Server-Cap (500) liegen. */
const BATCH_SIZE = 200
/** Harte Obergrenze gegen Mega-Payloads bei sehr großen Libraries. */
const MAX_DOCS = 2000

export interface AllGalleryDocsResult {
  /** Bisher geladene Dokumente (wächst batchweise bis zum Gesamtbestand). */
  docs: DocCardMeta[]
  /** true solange noch Batches ausstehen. */
  loading: boolean
  loadedCount: number
  /** Gesamtzahl laut Server (`total`), für die Fortschrittsanzeige. */
  totalCount: number
  /** true, wenn MAX_DOCS erreicht wurde — der Graph zeigt dann eine Teilmenge. */
  truncated: boolean
  error: string | null
}

const INITIAL_STATE: AllGalleryDocsResult = {
  docs: [],
  loading: false,
  loadedCount: 0,
  totalCount: 0,
  truncated: false,
  error: null,
}

export function useAllGalleryDocs(
  filters: Record<string, string[] | undefined>,
  searchQuery: string,
  libraryId?: string,
  options?: { enabled?: boolean; refreshKey?: number },
): AllGalleryDocsResult {
  const enabled = options?.enabled ?? false
  const refreshKey = options?.refreshKey ?? 0
  const [state, setState] = useState<AllGalleryDocsResult>(INITIAL_STATE)

  // Stabiler Dependency-Schlüssel statt Objekt-Identität (wie use-gallery-data).
  const filtersString = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    if (!enabled || !libraryId) {
      setState(INITIAL_STATE)
      return
    }
    let cancelled = false

    async function loadAll() {
      setState({ ...INITIAL_STATE, loading: true })
      const parsedFilters = JSON.parse(filtersString) as Record<string, string[] | undefined>
      const seenIds = new Set<string>()
      const all: DocCardMeta[] = []
      let skip = 0
      let total = 0
      try {
        for (;;) {
          const params = new URLSearchParams()
          Object.entries(parsedFilters).forEach(([k, arr]) => {
            if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
          })
          if (searchQuery.trim()) params.append('search', searchQuery.trim())
          params.append('limit', String(BATCH_SIZE))
          params.append('skip', String(skip))

          const url = `/api/chat/${encodeURIComponent(libraryId as string)}/docs?${params.toString()}`
          const res = await fetch(url, { cache: 'no-store' })
          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('application/json')) throw new Error(`Ungültige Antwort: ${res.status}`)
          const data = await res.json()
          if (!res.ok) {
            throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Dokumente')
          }
          if (cancelled) return

          const items = Array.isArray(data?.items) ? (data.items as DocCardMeta[]) : []
          if (typeof data?.total === 'number') total = data.total
          // Skip-Pagination kann bei nicht perfekt stabiler Sortierung Dubletten
          // liefern — defensiv nach fileId/id deduplizieren.
          for (const item of items) {
            const id = item.fileId || item.id
            if (id) {
              if (seenIds.has(id)) continue
              seenIds.add(id)
            }
            all.push(item)
          }

          const truncated = all.length >= MAX_DOCS
          const done = items.length < BATCH_SIZE || truncated
          setState({
            docs: [...all],
            loading: !done,
            loadedCount: all.length,
            totalCount: Math.max(total, all.length),
            truncated,
            error: null,
          })
          if (done) return
          skip += BATCH_SIZE
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
          setState((prev) => ({ ...prev, loading: false, error: msg }))
        }
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [enabled, libraryId, filtersString, searchQuery, refreshKey])

  return state
}
