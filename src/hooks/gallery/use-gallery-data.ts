'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'

export function useGalleryData(filters: Record<string, string[] | undefined>, mode: 'gallery' | 'story', searchQuery: string, libraryId?: string) {
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([k, arr]) => {
          if (k === 'fileId') return
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
        })
        const url = `/api/chat/${encodeURIComponent(libraryId)}/docs${params.toString() ? `?${params.toString()}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error(`Ungültige Antwort: ${res.status}`)
        const data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Dokumente')
        if (!cancelled && Array.isArray(data?.items)) setDocs(data.items as DocCardMeta[])
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, JSON.stringify(filters)])

  const filteredDocs = useMemo(() => {
    const fileIdFilter = filters.fileId
    let result = docs
    if (fileIdFilter && Array.isArray(fileIdFilter) && fileIdFilter.length > 0) {
      result = docs.filter(d => fileIdFilter.includes(d.fileId || '') || fileIdFilter.includes(d.id || ''))
    }
    if (mode === 'gallery' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(doc => {
        const titleMatch = doc.title?.toLowerCase().includes(query) || doc.shortTitle?.toLowerCase().includes(query)
        const speakerMatch = doc.speakers?.some(s => s.toLowerCase().includes(query))
        const authorMatch = doc.authors?.some(a => a.toLowerCase().includes(query))
        return titleMatch || speakerMatch || authorMatch
      })
    }
    return result
  }, [docs, filters.fileId, mode, searchQuery])

  const docsByYear = useMemo(() => {
    const grouped = new Map<number | string, DocCardMeta[]>()
    for (const doc of filteredDocs) {
      const year = doc.year || 'Ohne Jahrgang'
      if (!grouped.has(year)) grouped.set(year, [])
      grouped.get(year)!.push(doc)
    }
    const sorted = Array.from(grouped.entries()).sort((a, b) => {
      const yearA = a[0] === 'Ohne Jahrgang' ? 0 : (typeof a[0] === 'string' ? parseInt(a[0], 10) : a[0])
      const yearB = b[0] === 'Ohne Jahrgang' ? 0 : (typeof b[0] === 'string' ? parseInt(b[0], 10) : b[0])
      return yearB - yearA
    })
    return sorted
  }, [filteredDocs])

  return { docs, setDocs, loading, error, filteredDocs, docsByYear }
}

/**
 * Gruppiert Dokumente nach Referenzen
 * @param docs Alle verfügbaren Dokumente
 * @param references Referenzen, die vom LLM verwendet wurden
 * @param sources Sources, die vom Retriever gefunden wurden
 * @returns Gruppierte Dokumente: usedDocs (in Antwort verwendet) und unusedDocs (gefunden, aber nicht verwendet)
 */
export function groupDocsByReferences(
  docs: DocCardMeta[],
  references: ChatResponse['references'],
  sources?: QueryLog['sources']
): { usedDocs: DocCardMeta[]; unusedDocs: DocCardMeta[] } {
  // Extrahiere fileIds aus references
  const usedFileIds = new Set(references.map(ref => ref.fileId))
  
  // Filtere Dokumente, die in references sind
  const usedDocs = docs.filter(doc => {
    const fileId = doc.fileId || doc.id
    return usedFileIds.has(fileId)
  })
  
  // Für unusedDocs: Extrahiere fileIds aus sources, die nicht in references sind
  const unusedFileIds = new Set<string>()
  if (sources && sources.length > 0) {
    for (const source of sources) {
      // Extrahiere fileId aus source.id (Format: "fileId-chunkIndex" oder ähnlich)
      const fileId = source.id.split('-')[0]
      if (!usedFileIds.has(fileId)) {
        unusedFileIds.add(fileId)
      }
    }
  }
  
  // Filtere Dokumente, die in unusedFileIds sind
  const unusedDocs = docs.filter(doc => {
    const fileId = doc.fileId || doc.id
    return unusedFileIds.has(fileId)
  })
  
  return { usedDocs, unusedDocs }
}


