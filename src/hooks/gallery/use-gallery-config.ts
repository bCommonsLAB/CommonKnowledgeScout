'use client'

import { useEffect, useState } from 'react'
import type { GalleryTexts } from '@/lib/gallery/types'

export function useGalleryConfig(defaults: GalleryTexts, libraryId?: string) {
  const [texts, setTexts] = useState<GalleryTexts>(defaults)
  const [detailViewType, setDetailViewType] = useState<'book' | 'session'>('book')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/config`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        const galleryConfig = (data?.config as { gallery?: { detailViewType?: string } })?.gallery
        const publicPublishing = data?.publicPublishing as { 
          gallery?: { headline?: string; subtitle?: string; description?: string; filterDescription?: string }
        } | undefined
        const g = publicPublishing?.gallery
        if (cancelled) return
        const next: GalleryTexts = {
          headline: g?.headline || defaults.headline,
          subtitle: g?.subtitle || defaults.subtitle,
          description: g?.description || defaults.description,
          filterDescription: g?.filterDescription || defaults.filterDescription,
        }
        setTexts(next)
        const vt = galleryConfig?.detailViewType
        if (vt === 'book' || vt === 'session') setDetailViewType(vt)
      } catch {
        // ignore
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId, defaults.headline, defaults.subtitle, defaults.description, defaults.filterDescription])

  return { texts, detailViewType, setDetailViewType }
}


