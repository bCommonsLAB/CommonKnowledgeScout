'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  RETRIEVER_LABELS,
  TARGET_LANGUAGE_LABELS,
  CHARACTER_LABELS,
  SOCIAL_CONTEXT_LABELS,
  type Character,
} from '@/lib/chat/constants'

import type {
  AnswerLength,
  Retriever,
  TargetLanguage,
  SocialContext,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import { useStoryContext } from '@/hooks/use-story-context'
import type { QueryLog } from '@/types/query-log'

interface ChatConfigDisplayProps {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: string
  socialContext?: SocialContext
  libraryId?: string
  queryId?: string
  filters?: Record<string, unknown> // Optional: Filterparameter direkt übergeben (z.B. galleryFilters)
}

/**
 * Komponente zur Anzeige der Chat-Konfiguration
 * 
 * Zeigt dezent die Konfigurationsparameter unter einer Frage oder unter dem Chat-Panel an.
 */
export function ChatConfigDisplay({
  answerLength,
  retriever,
  targetLanguage,
  character,
  socialContext,
  libraryId,
  queryId,
  filters: filtersProp,
}: ChatConfigDisplayProps) {
  const { t } = useTranslation()
  const { targetLanguageLabels, characterLabels, socialContextLabels } = useStoryContext()
  const [filters, setFilters] = useState<Record<string, unknown> | null>(null)
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label?: string }>>([])

  // Erstelle Config-Items mit useMemo, damit sie sich aktualisieren, wenn Filter geladen werden
  const configItems = useMemo(() => {
    const items: string[] = []

    if (answerLength) {
      items.push(`${t('configDisplay.answerLength')} ${t(`chat.answerLengthLabels.${answerLength}`)}`)
    }

    if (retriever) {
      // Retriever-Labels werden aus den Übersetzungen geholt
      const retrieverLabel = retriever === 'chunk' 
        ? t('processing.retrieverChunk')
        : retriever === 'summary' || retriever === 'doc'
        ? t('processing.retrieverSummary')
        : retriever === 'auto'
        ? t('processing.retrieverAuto')
        : RETRIEVER_LABELS[retriever] || retriever
      items.push(`${t('configDisplay.method')} ${retrieverLabel}`)
    }

    if (targetLanguage) {
      const langLabel = targetLanguageLabels[targetLanguage] || TARGET_LANGUAGE_LABELS[targetLanguage] || targetLanguage
      items.push(`${t('configDisplay.language')} ${langLabel}`)
    }

    if (character) {
      const charLabel = typeof character === 'string' ? (characterLabels[character as Character] || CHARACTER_LABELS[character as Character] || character) : ''
      if (charLabel) {
        items.push(`${t('configDisplay.character')} ${charLabel}`)
      }
    }

    if (socialContext) {
      const contextLabel = socialContextLabels[socialContext] || SOCIAL_CONTEXT_LABELS[socialContext] || socialContext
      items.push(`${t('configDisplay.context')} ${contextLabel}`)
    }

    return items
  }, [answerLength, retriever, targetLanguage, character, socialContext, t, targetLanguageLabels, characterLabels, socialContextLabels])

  // Verwende übergebene Filter oder lade aus QueryLog
  useEffect(() => {
    // Wenn Filter direkt übergeben wurden, verwende diese
    if (filtersProp) {
      setFilters(filtersProp)
      return
    }

    // Ansonsten lade Filterparameter aus QueryLog, falls queryId vorhanden
    if (!queryId || !libraryId) {
      setFilters(null)
      return
    }

    let cancelled = false

    async function loadFilters() {
      // Type Guard: Prüfe nochmal, dass beide Werte vorhanden sind
      if (!queryId || !libraryId) {
        return
      }
      
      try {
        // Lade QueryLog mit Filter-Informationen
        const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
          cache: 'no-store'
        })
        
        if (!queryRes.ok || cancelled) return
        
        const queryLog = await queryRes.json() as QueryLog
        
        if (cancelled) return
        
        // Prüfe, ob Filter vorhanden sind
        const facetsSelected = queryLog.facetsSelected
        if (!facetsSelected || Object.keys(facetsSelected).length === 0) {
          setFilters(null)
          return
        }
        
        setFilters(facetsSelected)
      } catch (error) {
        console.error('[ChatConfigDisplay] Fehler beim Laden der Filter:', error)
        setFilters(null)
      }
    }

    loadFilters()

    return () => {
      cancelled = true
    }
  }, [libraryId, queryId, filtersProp])

  // Lade Facetten-Definitionen für Labels
  useEffect(() => {
    if (!libraryId) {
      setFacetDefs([])
      return
    }

    let cancelled = false

    async function loadFacetDefs() {
      // Type Guard: Prüfe nochmal, dass libraryId vorhanden ist
      if (!libraryId) {
        return
      }
      
      try {
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
        console.error('[ChatConfigDisplay] Fehler beim Laden der Facetten-Definitionen:', error)
        setFacetDefs([])
      }
    }

    loadFacetDefs()

    return () => {
      cancelled = true
    }
  }, [libraryId])

  // Formatiere Filter-Werte für Anzeige
  const formatFilterValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      const filtered = value.filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      return filtered.map(v => String(v).trim()).join(', ')
    }
    if (value && typeof value === 'object' && '$in' in value && Array.isArray(value.$in)) {
      const filtered = (value.$in as unknown[]).filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      return filtered.map(v => String(v).trim()).join(', ')
    }
    const str = String(value)
    return str.trim() || ''
  }

  // Füge Filterparameter zu Config-Items hinzu (mit useMemo, damit es sich aktualisiert, wenn Filter geladen werden)
  const allConfigItems = useMemo(() => {
    const items = [...configItems]
    
    if (filters && Object.keys(filters).length > 0) {
      for (const [metaKey, value] of Object.entries(filters)) {
        // Überspringe interne Filter
        if (metaKey === 'user' || metaKey === 'libraryId' || metaKey === 'kind') {
          continue
        }
        
        const def = facetDefs.find(d => d.metaKey === metaKey)
        const label = def?.label || metaKey
        const formattedValue = formatFilterValue(value)
        
        if (formattedValue && formattedValue.trim() !== '') {
          items.push(`${label}: ${formattedValue}`)
        }
      }
    }
    
    return items
  }, [configItems, filters, facetDefs])

  if (allConfigItems.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1 flex-wrap">
        {allConfigItems.map((item, index) => (
          <span key={index}>
            {item}
            {index < allConfigItems.length - 1 && <span className="mx-1">·</span>}
          </span>
        ))}
      </span>
    </div>
  )
}

