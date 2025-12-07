'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { galleryDataAtom } from '@/atoms/gallery-data'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'

export function useGalleryData(
  filters: Record<string, string[] | undefined>, 
  mode: 'gallery' | 'story', 
  searchQuery: string, 
  libraryId?: string,
  options?: { skipApiCall?: boolean; refreshKey?: number }
) {
  const setGalleryData = useSetAtom(galleryDataAtom)
  const galleryDataFromAtom = useAtomValue(galleryDataAtom)
  const skipApiCall = options?.skipApiCall ?? false
  
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 50
  
  // Memoize filters string für Dependency-Array
  const filtersString = useMemo(() => JSON.stringify(filters), [filters])
  
  // Reset bei Filter-Änderungen oder Refresh-Key-Änderung (nur wenn nicht skipApiCall)
  useEffect(() => {
    if (skipApiCall) return
    setPage(1)
    setHasMore(true)
    setDocs([])
    setTotalCount(0)
    setIsLoadingMore(false)
  }, [libraryId, filtersString, mode, searchQuery, skipApiCall, options?.refreshKey])
  
  useEffect(() => {
    // Überspringe API-Aufruf wenn skipApiCall true ist
    if (skipApiCall) return
    
    let cancelled = false
    const isFirstPage = page === 1
    
    async function load() {
      if (!libraryId) return
      
      // Beim ersten Laden: loading, beim Nachladen: isLoadingMore
      if (isFirstPage) {
        setLoading(true)
        setGalleryData(prev => ({ ...prev, loading: true, error: null }))
      } else {
        setIsLoadingMore(true)
        setGalleryData(prev => ({ ...prev, isLoadingMore: true }))
      }
      setError(null)
      try {
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([k, arr]) => {
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
        })
        
        // Pagination & Search
        params.append('limit', String(LIMIT))
        params.append('skip', String((page - 1) * LIMIT))
        if (searchQuery.trim()) {
          params.append('search', searchQuery.trim())
        }

        const url = `/api/chat/${encodeURIComponent(libraryId)}/docs${params.toString() ? `?${params.toString()}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error(`Ungültige Antwort: ${res.status}`)
        const data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Dokumente')
        
        if (!cancelled && Array.isArray(data?.items)) {
          const newItems = data.items as DocCardMeta[]
          const total = typeof data.total === 'number' ? data.total : newItems.length
          const hasMoreData = newItems.length === LIMIT
          const updatedDocs = isFirstPage ? newItems : [...docs, ...newItems]
          
          setHasMore(hasMoreData)
          setDocs(updatedDocs)
          setTotalCount(total)
          
          // Aktualisiere Atom für andere Komponenten
          setGalleryData({
            docs: updatedDocs,
            totalCount: total,
            loading: false,
            isLoadingMore: false,
            error: null,
            hasMore: hasMoreData,
          })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        if (!cancelled) {
          setError(msg)
          setGalleryData(prev => ({
            ...prev,
            loading: false,
            isLoadingMore: false,
            error: msg,
          }))
        }
      } finally {
        if (!cancelled) {
          if (isFirstPage) {
            setLoading(false)
            setGalleryData(prev => ({ ...prev, loading: false }))
          } else {
            setIsLoadingMore(false)
            setGalleryData(prev => ({ ...prev, isLoadingMore: false }))
          }
        }
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, page, JSON.stringify(filters), mode, searchQuery, skipApiCall, options?.refreshKey]) // Abhängigkeit von page und refreshKey


  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(p => p + 1)
    }
  }

  // Wenn skipApiCall true ist, verwende Atom-Daten für Rückgabe
  const shouldUseAtomData = skipApiCall
  const finalDocs = shouldUseAtomData ? galleryDataFromAtom.docs : docs
  const finalTotalCount = shouldUseAtomData ? galleryDataFromAtom.totalCount : totalCount
  const finalLoading = shouldUseAtomData ? galleryDataFromAtom.loading : loading
  const finalError = shouldUseAtomData ? galleryDataFromAtom.error : error
  const finalHasMore = shouldUseAtomData ? galleryDataFromAtom.hasMore : hasMore
  const finalIsLoadingMore = shouldUseAtomData ? galleryDataFromAtom.isLoadingMore : isLoadingMore
  
  const finalFilteredDocs = finalDocs
  
  const finalDocsByYear = useMemo(() => {
    const grouped = new Map<number | string, DocCardMeta[]>()
    for (const doc of finalFilteredDocs) {
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
  }, [finalFilteredDocs])
  
  return { 
    docs: finalDocs, 
    setDocs, 
    loading: finalLoading, 
    error: finalError, 
    filteredDocs: finalFilteredDocs, 
    docsByYear: finalDocsByYear, 
    loadMore, 
    hasMore: finalHasMore, 
    isLoadingMore: finalIsLoadingMore, 
    totalCount: finalTotalCount 
  }
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
  
  // Gruppiere Dokumente nach Referenzen
  
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


