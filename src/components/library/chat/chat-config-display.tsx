'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  RETRIEVER_LABELS,
  TARGET_LANGUAGE_LABELS,
  CHARACTER_LABELS,
  ACCESS_PERSPECTIVE_LABELS,
  SOCIAL_CONTEXT_LABELS,
  type Character,
  type AccessPerspective,
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
import { PerspectiveDisplay } from '@/components/library/shared/perspective-display'

interface ChatConfigDisplayProps {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
  accessPerspective?: AccessPerspective[] // Array (kann leer sein)
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
  accessPerspective,
  socialContext,
  libraryId,
  queryId,
  filters: filtersProp,
}: ChatConfigDisplayProps) {
  const { t } = useTranslation()
  const { targetLanguageLabels, characterLabels, accessPerspectiveLabels, socialContextLabels } = useStoryContext()
  const sessionHeaders = useSessionHeaders()
  const [filters, setFilters] = useState<Record<string, unknown> | null>(null)
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label?: string }>>([])
  const [isLoadingParams, setIsLoadingParams] = useState(false)
  
  // States für Parameter aus Query-Kollektion
  const [queryAnswerLength, setQueryAnswerLength] = useState<AnswerLength | undefined>(undefined)
  const [queryRetriever, setQueryRetriever] = useState<Retriever | undefined>(undefined)
  const [queryTargetLanguage, setQueryTargetLanguage] = useState<TargetLanguage | undefined>(undefined)
  const [queryCharacter, setQueryCharacter] = useState<Character[] | undefined>(undefined)
  const [queryAccessPerspective, setQueryAccessPerspective] = useState<AccessPerspective[] | undefined>(undefined)
  const [querySocialContext, setQuerySocialContext] = useState<SocialContext | undefined>(undefined)

  // Verwende Parameter aus Query, falls vorhanden, sonst Props als Fallback
  const effectiveAnswerLength = queryAnswerLength ?? answerLength
  const effectiveRetriever = queryRetriever ?? retriever
  const effectiveTargetLanguage = queryTargetLanguage ?? targetLanguage
  const effectiveCharacter = queryCharacter ?? character
  const effectiveAccessPerspective = queryAccessPerspective ?? accessPerspective
  const effectiveSocialContext = querySocialContext ?? socialContext

  // Erstelle Config-Items mit useMemo, damit sie sich aktualisieren, wenn Filter geladen werden
  // Verwende jetzt PerspectiveDisplay für die Perspektiven-Anzeige
  const hasPerspectiveParams = useMemo(() => {
    return !!(effectiveTargetLanguage || (effectiveCharacter && effectiveCharacter.length > 0) || 
             (effectiveAccessPerspective && effectiveAccessPerspective.length > 0) || effectiveSocialContext)
  }, [effectiveTargetLanguage, effectiveCharacter, effectiveAccessPerspective, effectiveSocialContext])

  // Lade alle Parameter aus QueryLog, falls queryId vorhanden ist UND keine Props übergeben wurden
  useEffect(() => {
    // Wenn Parameter direkt als Props übergeben wurden (z.B. aus cachedTOC), verwende diese
    // und lade NICHT aus QueryLog
    if (answerLength || retriever || targetLanguage || character || accessPerspective || socialContext || filtersProp) {
      // Props vorhanden: Verwende diese direkt, keine Query-Ladung nötig
      setQueryAnswerLength(answerLength)
      setQueryRetriever(retriever)
      setQueryTargetLanguage(targetLanguage)
      setQueryCharacter(character) // Array (kann leer sein)
      setQueryAccessPerspective(accessPerspective) // Array (kann leer sein)
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
      setQueryAccessPerspective(undefined)
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
        setQueryAccessPerspective(queryLog.accessPerspective)
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
        setQueryAccessPerspective(undefined)
        setQuerySocialContext(undefined)
        setIsLoadingParams(false)
      }
    }

    loadQueryParams()

    return () => {
      cancelled = true
    }
  }, [libraryId, queryId, filtersProp, sessionHeaders, answerLength, retriever, targetLanguage, character, accessPerspective, socialContext])

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

  // Zeige nichts während des Ladens, wenn queryId vorhanden ist (Parameter werden geladen)
  // Aber zeige auch nichts, wenn nach dem Laden keine Items vorhanden sind
  if (isLoadingParams && queryId) {
    return null // Während des Ladens nichts anzeigen
  }
  
  // Prüfe ob überhaupt etwas angezeigt werden soll
  const hasAnswerLengthOrRetriever = !!(effectiveAnswerLength || effectiveRetriever)
  const hasFilters = !!(filters && Object.keys(filters).length > 0)
  
  if (!hasPerspectiveParams && !hasAnswerLengthOrRetriever && !hasFilters) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      {/* Perspektiven-Anzeige mit gemeinsamer Komponente */}
      {hasPerspectiveParams && (
        <PerspectiveDisplay
          variant="inline"
          showAnswerLength={!!effectiveAnswerLength}
          showRetriever={!!effectiveRetriever}
          answerLength={effectiveAnswerLength}
          retriever={effectiveRetriever}
          targetLanguage={effectiveTargetLanguage}
          character={effectiveCharacter}
          accessPerspective={effectiveAccessPerspective}
          socialContext={effectiveSocialContext}
        />
      )}
      
      {/* Falls nur AnswerLength/Retriever vorhanden, aber keine Perspektive */}
      {!hasPerspectiveParams && hasAnswerLengthOrRetriever && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 flex-wrap">
            {effectiveAnswerLength && (
              <span>
                {t('configDisplay.answerLength')} {t(`chat.answerLengthLabels.${effectiveAnswerLength}`)}
              </span>
            )}
            {effectiveAnswerLength && effectiveRetriever && <span className="mx-1">·</span>}
            {effectiveRetriever && (
              <span>
                {t('configDisplay.method')} {
                  effectiveRetriever === 'chunk' 
                    ? t('processing.retrieverChunk')
                    : effectiveRetriever === 'summary' || effectiveRetriever === 'doc'
                    ? t('processing.retrieverSummary')
                    : effectiveRetriever === 'auto'
                    ? t('processing.retrieverAuto')
                    : RETRIEVER_LABELS[effectiveRetriever] || effectiveRetriever
                }
              </span>
            )}
          </span>
        </div>
      )}
      
      {/* Filter-Anzeige (falls vorhanden) */}
      {hasFilters && filters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 flex-wrap">
            {Object.entries(filters).map(([metaKey, value], index) => {
              // Überspringe interne Filter
              if (metaKey === 'user' || metaKey === 'libraryId' || metaKey === 'kind') {
                return null
              }
              
              const def = facetDefs.find(d => d.metaKey === metaKey)
              const label = def?.label || metaKey
              const formattedValue = formatFilterValue(value)
              
              if (!formattedValue || formattedValue.trim() === '') {
                return null
              }
              
              return (
                <span key={metaKey}>
                  {label}: {formattedValue}
                  {index < Object.keys(filters).length - 1 && <span className="mx-1">·</span>}
                </span>
              )
            })}
          </span>
        </div>
      )}
    </div>
  )
}

