'use client'

import { useEffect, useState } from 'react'
import { Filter } from 'lucide-react'
import type { QueryLog } from '@/types/query-log'

interface ChatFiltersDisplayProps {
  libraryId: string
  queryId?: string
}

/**
 * Zeigt dezent die verwendeten Filtereinstellungen für eine Chat-Antwort an.
 * Lädt die Filter-Informationen aus dem QueryLog über die queryId.
 */
export function ChatFiltersDisplay({ libraryId, queryId }: ChatFiltersDisplayProps) {
  const [filters, setFilters] = useState<Record<string, unknown> | null>(null)
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label?: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!queryId) {
      setFilters(null)
      return
    }

    let cancelled = false

    async function loadFilters() {
      // Type Guard: Prüfe nochmal, dass queryId vorhanden ist
      if (!queryId) {
        return
      }
      
      setLoading(true)
      try {
        // Lade QueryLog mit Filter-Informationen
        const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
          cache: 'no-store'
        })
        
        if (!queryRes.ok || cancelled) return
        
        const queryLog = await queryRes.json() as QueryLog
        
        if (cancelled) return
        
        // Prüfe, ob Filter vorhanden sind
        // Extrahiere Filter aus cacheParams, falls vorhanden (neue Einträge), sonst Root-Feld (alte Einträge)
        const facetsSelected = queryLog.cacheParams?.facetsSelected ?? queryLog.facetsSelected
        if (!facetsSelected || Object.keys(facetsSelected).length === 0) {
          setFilters(null)
          return
        }
        
        setFilters(facetsSelected)
        
        // Lade Facetten-Definitionen für Labels
        const facetsRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/facets`, {
          cache: 'no-store'
        })
        
        if (!facetsRes.ok || cancelled) return
        
        const facetsData = await facetsRes.json() as { facets?: Array<{ metaKey: string; label?: string }> }
        
        if (cancelled) return
        
        if (Array.isArray(facetsData.facets)) {
          setFacetDefs(facetsData.facets)
        }
      } catch (error) {
        console.error('[ChatFiltersDisplay] Fehler beim Laden der Filter:', error)
        setFilters(null)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadFilters()

    return () => {
      cancelled = true
    }
  }, [libraryId, queryId])

  // Keine Filter vorhanden oder noch am Laden
  if (!filters || Object.keys(filters).length === 0 || loading) {
    return null
  }

  // Formatiere Filter-Werte für Anzeige
  const formatFilterValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      // Entferne leere Strings und formatiere
      const filtered = value.filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      return filtered.map(v => String(v).trim()).join(', ')
    }
    if (value && typeof value === 'object' && '$in' in value && Array.isArray(value.$in)) {
      // Pinecone $in Format
      const filtered = (value.$in as unknown[]).filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      return filtered.map(v => String(v).trim()).join(', ')
    }
    const str = String(value)
    return str.trim() || ''
  }

  // Erstelle Filter-Items mit Labels
  const filterItems: Array<{ label: string; value: string }> = []
  
  for (const [metaKey, value] of Object.entries(filters)) {
    // Überspringe interne Filter
    if (metaKey === 'user' || metaKey === 'libraryId' || metaKey === 'kind') {
      continue
    }
    
    const def = facetDefs.find(d => d.metaKey === metaKey)
    const label = def?.label || metaKey
    const formattedValue = formatFilterValue(value)
    
    // Nur hinzufügen, wenn Wert nicht leer ist
    if (formattedValue && formattedValue.trim() !== '') {
      filterItems.push({ label, value: formattedValue })
    }
  }

  // Keine anzeigbaren Filter gefunden
  if (filterItems.length === 0) {
    return null
  }

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3 pb-2 border-b border-border/30">
      <Filter className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-60" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {filterItems.map((item, index) => (
            <span key={index} className="inline-flex items-center gap-1.5">
              <span className="font-medium opacity-80">{item.label}:</span>
              <span className="opacity-70">{item.value}</span>
              {index < filterItems.length - 1 && (
                <span className="text-muted-foreground/40 mx-0.5">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

