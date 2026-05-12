'use client'

import { useEffect, useRef, useState } from 'react'
import { useLibraryRole } from './use-library-role'
import type { SourceCommentCountsResponse } from '@/types/source-comment'

interface UseSourceCommentCountsResult {
  /** Map fileId -> sichtbare Kommentaranzahl (0 wenn unbekannt). */
  counts: Record<string, number>
  /** true wenn der Server die Counts auf "nur eigene" reduziert hat. */
  filteredToOwn: boolean
  isLoading: boolean
}

/**
 * Bulk-Counter fuer die Tabellen-Render-Spalte.
 * - Cached counts pro fileId und behaelt sie bei Re-Render.
 * - Debounced den Request (300 ms), damit Scroll-Updates nicht jedes
 *   Re-Render eine Aggregation triggern.
 */
export function useSourceCommentCounts(
  libraryId: string | undefined,
  visibleFileIds: string[],
): UseSourceCommentCountsResult {
  const { isSignedIn, isLoading: isRoleLoading } = useLibraryRole(libraryId)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filteredToOwn, setFilteredToOwn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const cacheRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (isRoleLoading) return
    if (!libraryId || !isSignedIn || visibleFileIds.length === 0) {
      setCounts(cacheRef.current)
      return
    }

    // Nur die fileIds nachladen, die wir noch nicht im Cache haben - das
    // haelt die Aggregation klein, wenn der User scrollt.
    const missing = visibleFileIds.filter((id) => cacheRef.current[id] === undefined)
    if (missing.length === 0) {
      setCounts({ ...cacheRef.current })
      return
    }

    let cancelled = false
    setIsLoading(true)

    const handle = setTimeout(async () => {
      try {
        const url = `/api/library/${encodeURIComponent(libraryId)}/source-comments?fileIds=${encodeURIComponent(missing.join(','))}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Counts konnten nicht geladen werden (HTTP ${res.status})`)
        }
        const json = (await res.json()) as SourceCommentCountsResponse
        if (cancelled) return
        cacheRef.current = { ...cacheRef.current, ...json.counts }
        setCounts({ ...cacheRef.current })
        setFilteredToOwn(Boolean(json.filteredToOwn))
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useSourceCommentCounts] Laden fehlgeschlagen:', message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [libraryId, isSignedIn, isRoleLoading, visibleFileIds])

  return { counts, filteredToOwn, isLoading }
}
