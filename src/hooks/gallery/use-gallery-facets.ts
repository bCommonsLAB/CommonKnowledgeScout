'use client'

import { useEffect, useState } from 'react'

export function useGalleryFacets(libraryId?: string, filters?: Record<string, string[] | undefined>) {
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>>([])

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
        const url = `/api/chat/${encodeURIComponent(libraryId)}/facets${params.toString() ? `?${params.toString()}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled && res.ok) setFacetDefs(Array.isArray(data?.facets) ? data.facets : [])
      } catch {
        // ignore
      }
    }
    loadFacets()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, JSON.stringify(filters || {})])

  return { facetDefs, setFacetDefs }
}


