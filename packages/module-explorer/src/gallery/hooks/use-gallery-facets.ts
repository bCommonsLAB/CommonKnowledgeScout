'use client'

import { useEffect, useState } from 'react'
import { useInstanz } from '../contexts/gallery-host-context'

export interface UseGalleryFacetsOptions {
  /**
   * Schliesst einen `detailViewType` serverseitig aus Typ-Liste und
   * Zaehlwerten aus — muss zum Ausschluss der Dokumentliste passen
   * (`useGalleryData`), sonst weichen Facetten und Liste voneinander ab.
   */
  excludeDetailViewType?: string
  /** „Im Fokus" (ADR 0012): `starred=1` wie bei der Liste, damit die Zaehlwerte passen. */
  starred?: boolean
}

export function useGalleryFacets(
  libraryId?: string,
  filters?: Record<string, string[] | undefined>,
  options?: UseGalleryFacetsOptions,
) {
  const instanz = useInstanz()
  const excludeDetailViewType = options?.excludeDetailViewType
  const starred = options?.starred ?? false
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>>([])
  // A4a — vorhandene Inhaltstypen (Leitfilter-Optionen, gemischte Libraries).
  const [viewTypes, setViewTypes] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadFacets() {
      if (!libraryId) return
      try {
        const params = new URLSearchParams()
        Object.entries(filters || {}).forEach(([k, arr]) => {
          if (k === 'fileId') return
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
        })
        if (excludeDetailViewType) {
          params.append('excludeDetailViewType', excludeDetailViewType)
        }
        if (starred) params.append('starred', '1')
        const url = `/api/chat/${encodeURIComponent(libraryId)}/facets${params.toString() ? `?${params.toString()}` : ''}`
        const res = await instanz.fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && res.ok) {
          setFacetDefs(Array.isArray(data?.facets) ? data.facets : [])
          setViewTypes(Array.isArray(data?.viewTypes) ? data.viewTypes : [])
        }
      } catch {
        // ignore
      }
    }
    loadFacets()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, JSON.stringify(filters || {}), instanz, excludeDetailViewType, starred])

  return { facetDefs, setFacetDefs, viewTypes }
}


