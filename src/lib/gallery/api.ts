'use client'

import type { DocCardMeta, GalleryTexts } from './types'

/**
 * Helper: Liest Locale aus Cookie (client-seitig)
 * Kann in async functions verwendet werden
 */
function getLocaleFromAtom(): string {
  if (typeof window === 'undefined') return 'en'
  try {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1]
    return cookieValue || 'en'
  } catch {
    return 'en'
  }
}

export async function fetchGalleryConfig(libraryId: string) {
  const locale = getLocaleFromAtom()
  const url = `/api/chat/${encodeURIComponent(libraryId)}/config`
  const res = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'Accept-Language': locale,
    },
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

export async function fetchDocs(libraryId: string, filters: Record<string, string[] | undefined>) {
  const locale = getLocaleFromAtom()
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, arr]) => {
    if (k === 'fileId') return
    if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
  })
  const url = `/api/chat/${encodeURIComponent(libraryId)}/docs${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'Accept-Language': locale,
    },
  })
  const data = await res.json() as { items?: DocCardMeta[] }
  return { ok: res.ok, data }
}

export async function fetchFacets(libraryId: string, filters: Record<string, string[] | undefined>) {
  const locale = getLocaleFromAtom()
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, arr]) => {
    if (k === 'fileId') return
    if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
  })
  const url = `/api/chat/${encodeURIComponent(libraryId)}/facets${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'Accept-Language': locale,
    },
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

interface GalleryConfigData {
  publicPublishing?: {
    gallery?: {
      headline?: string
      subtitle?: string
      description?: string
      filterDescription?: string
    }
  }
}

export function extractGalleryTexts(data: unknown): GalleryTexts {
  const typedData = data as GalleryConfigData
  const gallery = typedData?.publicPublishing?.gallery || {}
  return {
    headline: gallery.headline || 'Entdecke, was Menschen auf der SFSCon gesagt haben',
    subtitle: gallery.subtitle || 'Befrage das kollektive Wissen',
    description:
      gallery.description ||
      'Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen.',
    filterDescription:
      gallery.filterDescription ||
      'Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren.',
  }
}


