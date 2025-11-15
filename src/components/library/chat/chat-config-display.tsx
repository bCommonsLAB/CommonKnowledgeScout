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
import { useSessionHeaders } from '@/hooks/use-session-headers'
import type { QueryLog } from '@/types/query-log'

interface ChatConfigDisplayProps {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
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
  const sessionHeaders = useSessionHeaders()
  const [filters, setFilters] = useState<Record<string, unknown> | null>(null)
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label?: string }>>([])
  const [isLoadingParams, setIsLoadingParams] = useState(false)
  
  // States für Parameter aus Query-Kollektion
  const [queryAnswerLength, setQueryAnswerLength] = useState<AnswerLength | undefined>(undefined)
  const [queryRetriever, setQueryRetriever] = useState<Retriever | undefined>(undefined)
  const [queryTargetLanguage, setQueryTargetLanguage] = useState<TargetLanguage | undefined>(undefined)
  const [queryCharacter, setQueryCharacter] = useState<Character[] | undefined>(undefined)
  const [querySocialContext, setQuerySocialContext] = useState<SocialContext | undefined>(undefined)

  // Verwende Parameter aus Query, falls vorhanden, sonst Props als Fallback
  const effectiveAnswerLength = queryAnswerLength ?? answerLength
  const effectiveRetriever = queryRetriever ?? retriever
  const effectiveTargetLanguage = queryTargetLanguage ?? targetLanguage
  const effectiveCharacter = queryCharacter ?? character
  const effectiveSocialContext = querySocialContext ?? socialContext

  // Erstelle Config-Items mit useMemo, damit sie sich aktualisieren, wenn Filter geladen werden
  const configItems = useMemo(() => {
    const items: string[] = []

    if (effectiveAnswerLength) {
      items.push(`${t('configDisplay.answerLength')} ${t(`chat.answerLengthLabels.${effectiveAnswerLength}`)}`)
    }

    if (effectiveRetriever) {
      // Retriever-Labels werden aus den Übersetzungen geholt
      const retrieverLabel = effectiveRetriever === 'chunk' 
        ? t('processing.retrieverChunk')
        : effectiveRetriever === 'summary' || effectiveRetriever === 'doc'
        ? t('processing.retrieverSummary')
        : effectiveRetriever === 'auto'
        ? t('processing.retrieverAuto')
        : RETRIEVER_LABELS[effectiveRetriever] || effectiveRetriever
      items.push(`${t('configDisplay.method')} ${retrieverLabel}`)
    }

    if (effectiveTargetLanguage) {
      const langLabel = targetLanguageLabels[effectiveTargetLanguage] || TARGET_LANGUAGE_LABELS[effectiveTargetLanguage] || effectiveTargetLanguage
      items.push(`${t('configDisplay.language')} ${langLabel}`)
    }

    if (effectiveCharacter && effectiveCharacter.length > 0) {
      // Verwende ersten Wert für Label-Lookup
      const firstChar = effectiveCharacter[0]
      const charLabel = characterLabels[firstChar] || CHARACTER_LABELS[firstChar] || firstChar
      if (charLabel) {
        items.push(`${t('configDisplay.character')} ${charLabel}`)
      }
    }

    if (effectiveSocialContext) {
      const contextLabel = socialContextLabels[effectiveSocialContext] || SOCIAL_CONTEXT_LABELS[effectiveSocialContext] || effectiveSocialContext
      items.push(`${t('configDisplay.context')} ${contextLabel}`)
    }

    return items
  }, [effectiveAnswerLength, effectiveRetriever, effectiveTargetLanguage, effectiveCharacter, effectiveSocialContext, t, targetLanguageLabels, characterLabels, socialContextLabels])

  // Lade alle Parameter aus QueryLog, falls queryId vorhanden ist UND keine Props übergeben wurden
  useEffect(() => {
    // Wenn Parameter direkt als Props übergeben wurden (z.B. aus cachedTOC), verwende diese
    // und lade NICHT aus QueryLog
    if (answerLength || retriever || targetLanguage || character || socialContext || filtersProp) {
      // Props vorhanden: Verwende diese direkt, keine Query-Ladung nötig
      setQueryAnswerLength(answerLength)
      setQueryRetriever(retriever)
      setQueryTargetLanguage(targetLanguage)
      setQueryCharacter(character) // Array (kann leer sein)
      setQuerySocialContext(socialContext)
      setFilters(filtersProp || null)
      return
    }

    // Wenn keine queryId vorhanden, setze alles auf null/undefined
    if (!queryId || !libraryId) {
      setFilters(null)
      setQueryAnswerLength(undefined)
      setQueryRetriever(undefined)
      setQueryTargetLanguage(undefined)
      setQueryCharacter(undefined)
      setQuerySocialContext(undefined)
      return
    }

    let cancelled = false

    async function loadQueryParams() {
      // Type Guard: Prüfe nochmal, dass beide Werte vorhanden sind
      if (!queryId || !libraryId) {
        setIsLoadingParams(false)
        return
      }
      
      setIsLoadingParams(true)
      try {
        // Lade QueryLog mit allen Parametern
        const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
        })
        
        if (!queryRes.ok || cancelled) {
          setIsLoadingParams(false)
          return
        }
        
        const queryLog = await queryRes.json() as QueryLog
        
        if (cancelled) {
          setIsLoadingParams(false)
          return
        }
        
        // Setze alle Parameter aus QueryLog
        setQueryAnswerLength(queryLog.answerLength)
        setQueryRetriever(queryLog.retriever)
        setQueryTargetLanguage(queryLog.targetLanguage)
        setQueryCharacter(queryLog.character)
        setQuerySocialContext(queryLog.socialContext)
        
        // Setze Filter: Verwende übergebene Filter nur wenn keine queryId vorhanden ist
        // Wenn queryId vorhanden ist, verwende immer Filter aus QueryLog
        const facetsSelected = queryLog.facetsSelected
        if (!facetsSelected || Object.keys(facetsSelected).length === 0) {
          setFilters(null)
        } else {
          setFilters(facetsSelected)
        }
        setIsLoadingParams(false)
      } catch (error) {
        console.error('[ChatConfigDisplay] Fehler beim Laden der Query-Parameter:', error)
        setFilters(null)
        setQueryAnswerLength(undefined)
        setQueryRetriever(undefined)
        setQueryTargetLanguage(undefined)
        setQueryCharacter(undefined)
        setQuerySocialContext(undefined)
        setIsLoadingParams(false)
      }
    }

    loadQueryParams()

    return () => {
      cancelled = true
    }
  }, [libraryId, queryId, filtersProp, sessionHeaders, answerLength, retriever, targetLanguage, character, socialContext])

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

  // Zeige nichts während des Ladens, wenn queryId vorhanden ist (Parameter werden geladen)
  // Aber zeige auch nichts, wenn nach dem Laden keine Items vorhanden sind
  if (isLoadingParams && queryId) {
    return null // Während des Ladens nichts anzeigen
  }
  
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

