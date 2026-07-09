'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterContextBar } from '@/components/library/filter-context-bar'
import { StoryModeHeader } from '@/components/library/story/story-mode-header'
import { GalleryStickyHeader } from '@/components/library/gallery/gallery-sticky-header'
import { CaptureContentButton } from '@/components/submissions/capture-content-button'
import { FiltersPanel } from '@/components/library/gallery/filters-panel'
import { ViewTypeLeadFilter } from '@/components/library/gallery/view-type-lead-filter'
import { ItemsView } from '@/components/library/gallery/items-view'
import { GroupedItemsView } from '@/components/library/gallery/grouped-items-view'
import { groupDocsByReferences } from '@/hooks/gallery/use-gallery-data'
import type { ViewMode } from '@/components/library/gallery/gallery-sticky-header'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { toast } from '@/components/ui/use-toast'
import type { QueryLog } from '@/types/query-log'
import type { ChatResponse } from '@/types/chat-response'
import { MobileFiltersSheet } from '@/components/library/gallery/mobile-filters-sheet'
import { DetailOverlay } from '@/components/library/gallery/detail-overlay'
import { useGalleryMode } from '@/hooks/gallery/use-gallery-mode'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useGalleryConfig } from '@/hooks/gallery/use-gallery-config'
import { useGalleryData } from '@/hooks/gallery/use-gallery-data'
import { useAllGalleryDocs } from '@/hooks/gallery/use-all-gallery-docs'
import { useGalleryFacets } from '@/hooks/gallery/use-gallery-facets'
import { useGallerySums } from '@/hooks/gallery/use-gallery-sums'
import { getSummableFields } from '@/lib/detail-view-types/registry'
import { useGalleryEvents } from '@/hooks/gallery/use-gallery-events'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { TemplatePreviewDetailViewType } from '@/lib/templates/template-types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ReferencesSheet } from './references-sheet'
import { openDocumentBySlug, closeDocument } from '@/utils/document-navigation'
import { docMatchesNavigationSlug, getEffectiveDocumentNavigationSlug } from '@/utils/document-slug'
import { useIsLibraryOwner } from '@/hooks/gallery/use-is-library-owner'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useOwnFavoriteIds, useUserStates } from '@/hooks/gallery/use-user-states'
import { useUser } from '@clerk/nextjs'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { getPreferredUserDisplayName } from '@/lib/auth/user-display-name'
import { applyFavoriteToggleOptimistic, findDocInGroupedDocs } from '@/lib/gallery/apply-favorite-optimistic'
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils'
import dynamic from 'next/dynamic'
import { storyCharacterAtom } from '@/atoms/story-context-atom'
import { normalizeGalleryCardDensity } from '@/lib/gallery/gallery-card-density'

// Pure-Helpers + Hooks (Welle 3-III-a Modul-Split, siehe gallery-root/)
import {
  resolveInitialDetailViewType,
  resolveGroupByField,
  pickFacetsForTableColumns,
  resolveDetailViewTypeForDoc,
} from './gallery-root/helpers'
import { useIsMobile } from './gallery-root/hooks/use-is-mobile'
import { useCardDensity } from './gallery-root/hooks/use-card-density'

export interface GalleryRootProps {
  libraryIdProp?: string
  /** Wenn true, werden die Tabs nicht gerendert (z.B. wenn sie bereits im Header sind) */
  hideTabs?: boolean
  /** Optionale Startseiten-Vorschau (Draft oder veröffentlichte Live-Site) */
  siteViewSrc?: string | null
  /** Steuert, ob der Tab "Startseite" angeboten wird */
  showSiteTab?: boolean
  /** Sandbox für die eingebettete Startseite */
  siteSandbox?: string
}

const LazyChatPanel = dynamic(
  () => import('@/components/library/chat/chat-panel').then((module) => module.ChatPanel),
  {
    ssr: false,
    loading: () => <div className='text-sm text-muted-foreground p-4'>Lade Story-Panel…</div>,
  }
)

// Graph-Modus client-only laden (D3 nutzt Browser-APIs; kein SSR).
const LazyDocGraph = dynamic(
  () => import('@/components/library/gallery/graph/doc-graph').then((module) => module.DocGraph),
  {
    ssr: false,
    loading: () => <div className='text-sm text-muted-foreground p-4'>Lade Graph…</div>,
  }
)

export function GalleryRoot({
  libraryIdProp,
  hideTabs = false,
  siteViewSrc = null,
  showSiteTab = false,
  siteSandbox = "allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
}: GalleryRootProps) {
  const { t } = useTranslation()
  const libraryIdFromAtom = useAtomValue(activeLibraryIdAtom)
  const libraryId = libraryIdProp || libraryIdFromAtom
  const libraries = useAtomValue(librariesAtom)
  const setLibraries = useSetAtom(librariesAtom)
  const [filters, setFilters] = useAtom(galleryFiltersAtom)
  const [showFilters, setShowFilters] = useState(false)
  const isClosingRef = React.useRef(false)
  const isSwitchingToStoryModeRef = React.useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Suche debounced an die Daten-Hooks reichen: ohne Debounce loest jeder
  // Tastendruck einen kompletten Refetch + Listen-Neuaufbau aus (Befund
  // 2026-07-08). Das Eingabefeld bleibt an `searchQuery` gebunden.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const chatReferences = useAtomValue(chatReferencesAtom)
  const [showReferencesSheet, setShowReferencesSheet] = useState(false)
  const [referencesSheetMode, setReferencesSheetMode] = useState<'answer' | 'toc' | null>(null)
  const [referencesSheetData, setReferencesSheetData] = useState<{
    references?: ChatResponse['references']
    queryId?: string
  } | null>(null)
  const prevQueryIdRef = React.useRef<string | undefined>(undefined)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sessionHeaders = useSessionHeaders()
  const [sources, setSources] = React.useState<QueryLog['sources']>([])
  
  // Nur den Character-Atomwert lesen (leichtgewichtig).
  // Vermeidet den schweren useStoryContext-Hook inkl. Modell-Fetch im Gallery-Load.
  const character = useAtomValue(storyCharacterAtom)

  // Lade detailViewType und groupByField direkt aus dem librariesAtom, um Flackern zu vermeiden
  const activeLibrary = libraries.find(lib => lib.id === libraryId)
  
  // Robustes Laden der Gallery-Config: Direkt aus dem Raw-Objekt lesen
  const chatConfig = activeLibrary?.config?.chat
  const rawGalleryConfig = chatConfig?.gallery as Record<string, unknown> | undefined
  
  // Debug: Was wird tatsächlich geladen?
  React.useEffect(() => {
    console.log('[GalleryRoot] Config geladen:', {
      libraryId,
      hasActiveLibrary: !!activeLibrary,
      chatConfigKeys: chatConfig ? Object.keys(chatConfig) : [],
      rawGalleryConfig,
      galleryConfigKeys: rawGalleryConfig ? Object.keys(rawGalleryConfig) : [],
      groupByField: rawGalleryConfig?.groupByField,
      detailViewType: rawGalleryConfig?.detailViewType,
    })
  }, [libraryId, activeLibrary, chatConfig, rawGalleryConfig])
  
  const initialDetailViewType = useMemo(
    () => resolveInitialDetailViewType(rawGalleryConfig?.detailViewType),
    [rawGalleryConfig?.detailViewType],
  )

  // Gruppierungsfeld aus Library-Konfiguration (default: 'year').
  // Helper validiert und liefert kein silent fallback (siehe helpers.ts).
  const groupByField = resolveGroupByField(rawGalleryConfig?.groupByField)

  /** Library-Default für Galerie-Raster; Session-Override hat Vorrang (siehe useCardDensity). */
  const configCardDensity = useMemo(
    () => normalizeGalleryCardDensity(rawGalleryConfig?.galleryCardDensity),
    [rawGalleryConfig?.galleryCardDensity]
  )
  const { cardDensity, setCardDensity: handleCardDensityChange } = useCardDensity({
    libraryId,
    configDefault: configCardDensity,
  })

  // Facetten, die als Spalten in der Tabellenansicht angezeigt werden (showInTable === true)
  const tableColumnFacets = useMemo(
    () => pickFacetsForTableColumns(rawGalleryConfig?.facets),
    [rawGalleryConfig?.facets],
  )

  // Hooks
  const { mode, setMode, containerRef } = useGalleryMode()
  const hasSiteView = showSiteTab && typeof siteViewSrc === 'string' && siteViewSrc.length > 0

  // Kein stiller Fallback: Wenn kein Site-Tab erlaubt ist, aber ?view=site in der URL steht,
  // springen wir explizit zurück auf Inhalte.
  useEffect(() => {
    if (mode === 'site' && !hasSiteView) {
      setMode('gallery')
    }
  }, [mode, hasSiteView, setMode])
  
  // Mode und searchParams werden automatisch über React State verwaltet
  
  // Prüfe beim Wechsel zum Story-Modus, ob Perspektive gesetzt ist
  useEffect(() => {
    if (mode === 'story') {
      // Prüfe ob bereits Perspektive gesetzt ist (Character-Array nicht leer)
      const hasPerspective = character.length > 0
      const isDefaultPerspective = character.length === 1 && character[0] === 'business'
      
      // Prüfe localStorage-Flag (für einmaliges Öffnen)
      const perspectiveSetFlag = typeof window !== 'undefined' 
        ? localStorage.getItem('story-perspective-set')
        : null
      
      // Navigiere zur Perspective-Seite nur wenn:
      // 1. Keine Perspektive gesetzt ist ODER nur Default
      // 2. Flag noch nicht gesetzt ist (beim ersten Mal)
      // 3. Wir nicht bereits auf der Perspective-Seite sind
      if ((!hasPerspective || isDefaultPerspective) && !perspectiveSetFlag && pathname && !pathname.includes('/perspective')) {
        // Prüfe ob wir auf einer explore-Seite sind
        const isExplorePage = pathname.startsWith('/explore/')
        if (isExplorePage) {
          // Extrahiere Slug aus pathname
          const slugMatch = pathname.match(/\/explore\/([^/]+)/)
          if (slugMatch && slugMatch[1]) {
            router.push(`/explore/${slugMatch[1]}/perspective`)
          }
        } else if (pathname.startsWith('/library/gallery')) {
          // Für normale Library-Seiten: Navigiere zur Perspective-Seite mit libraryId
          if (libraryId) {
            const params = new URLSearchParams(searchParams?.toString() || '')
            params.set('libraryId', libraryId)
            params.set('from', 'story')
            router.push(`/library/gallery/perspective?${params.toString()}`)
          }
        }
      }
    }
  }, [mode, character, pathname, router, libraryId, searchParams])
  // useGalleryConfig verwendet jetzt direkt die Übersetzungen basierend auf detailViewType
  // initialDetailViewType verhindert das Flackern beim ersten Render
  const { texts, detailViewType } = useGalleryConfig(
    { headline: '', subtitle: '', description: '', filterDescription: '' }, 
    libraryId,
    initialDetailViewType
  )
  
  // State für Refresh-Trigger nach Löschung
  const [refreshKey, setRefreshKey] = React.useState(0)
  const galleryDataMode = mode === 'site' ? 'gallery' : mode
  
  // Verwende refreshKey als Dependency, aber nicht als Teil des searchQuery
  // useGalleryData wird automatisch neu laden, wenn sich refreshKey ändert (über useEffect)
  const { isMember: isLibraryMember } = useLibraryRole(libraryId)
  const onlyFavoritesParam = searchParams?.get('favorites') === '1'
  const onlyFavoritesActive = onlyFavoritesParam && isLibraryMember
  // "Mit Sternen": Team-Aggregat-Filter (mind. 1 Stern von irgendeinem
  // Mitglied, inkl. eigener). Unabhaengig von "Nur Favoriten" (= nur eigene);
  // beide koennen kombiniert werden (Schnittmenge).
  const onlyStarredParam = searchParams?.get('starred') === '1'
  const onlyStarredActive = onlyStarredParam && isLibraryMember
  // "Mit Kommentaren": Quellen mit mind. 1 (nicht-geloeschten) Kommentar
  // (commentCount kommt member-only per $lookup am Galerie-Doc).
  const onlyCommentedParam = searchParams?.get('commented') === '1'
  const onlyCommentedActive = onlyCommentedParam && isLibraryMember
  const anyEngagementFilterActive =
    onlyFavoritesActive || onlyStarredActive || onlyCommentedActive
  const sortParam = searchParams?.get('sort')
  const sortByStarsActive = sortParam === 'stars' && isLibraryMember
  const sortByRatingActive = sortParam === 'rating'

  // Globale Spalten-Sortierung der Tabellenansicht (serverseitig, ueber den
  // GESAMTEN gefilterten Bestand). Aktiv nur im Table-Mode; die synthetische
  // Prio-Spalte wird auf das persistierte Feld gemappt.
  const [tableSort, setTableSort] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null)
  const tableSortForApi = useMemo(() => {
    if (!tableSort || viewMode !== 'table') return null
    const field = tableSort.column === '__priorityIndex' ? 'prioritaets_index' : tableSort.column
    return { field, dir: tableSort.dir }
  }, [tableSort, viewMode])

  const {
    docs,
    loading,
    error,
    filteredDocs,
    docsByYear,
    loadMore,
    hasMore,
    isLoadingMore,
    totalCount,
    mutateDoc,
  } = useGalleryData(filters, galleryDataMode, debouncedSearchQuery, libraryId, {
    refreshKey,
    groupByField,
    sortByStars: sortByStarsActive,
    sortByRating: sortByRatingActive,
    sortByColumn: tableSortForApi,
  })
  const { isOwner } = useIsLibraryOwner(libraryId)

  // Summen-Fusszeile (Plan summen-und-synergie-aggregation): serverseitiges
  // Aggregat ueber den GESAMTEN gefilterten Bestand. Nur im Table-Mode und
  // nur, wenn der ViewType additive Summenfelder definiert. Bei aktiven
  // Engagement-Filtern (nur clientseitig) waere die Server-Summe still
  // falsch -> bewusst deaktivieren statt Falsches anzeigen.
  const summableFields = useMemo(() => getSummableFields(detailViewType), [detailViewType])
  const tableSums = useGallerySums(filters, debouncedSearchQuery, libraryId, {
    enabled:
      viewMode === 'table' &&
      summableFields.length > 0 &&
      !(onlyFavoritesActive || onlyStarredActive || onlyCommentedActive),
    refreshKey,
  })

  // Eigene Favoriten-IDs nur laden, wenn der "Nur Favoriten"-Filter
  // aktiv ist - Fallback bis `isFavorite` auf allen Karten verfuegbar ist.
  const { favoriteIds } = useOwnFavoriteIds(libraryId, { enabled: onlyFavoritesActive })
  const { user } = useUser()
  const selfEmail = useMemo(() => getPreferredUserEmail(user), [user])
  const selfName = useMemo(() => getPreferredUserDisplayName(user), [user])
  const { setState: setUserStarState } = useUserStates(libraryId, [])

  // Gemeinsames Praedikat fuer die clientseitigen Engagement-Filter:
  // - "Nur Favoriten": nur eigene Sterne (isFavorite, favoriteIds als Fallback).
  // - "Mit Sternen": Team-Aggregat (favoriteCount > 0).
  // - "Mit Kommentaren": Team-Aggregat (commentCount > 0).
  // Mehrere aktiv = Schnittmenge.
  const matchesEngagementFilters = React.useCallback(
    (d: DocCardMeta): boolean => {
      if (!d.fileId) return false
      if (onlyFavoritesActive && !(d.isFavorite === true || favoriteIds.has(d.fileId))) {
        return false
      }
      if (onlyStarredActive && (d.favoriteCount ?? 0) <= 0) {
        return false
      }
      if (onlyCommentedActive && (d.commentCount ?? 0) <= 0) {
        return false
      }
      return true
    },
    [onlyFavoritesActive, onlyStarredActive, onlyCommentedActive, favoriteIds],
  )

  const filteredDocsByYear = React.useMemo(() => {
    if (!anyEngagementFilterActive) return docsByYear
    return docsByYear
      .map(
        ([key, group]) =>
          [key, group.filter(matchesEngagementFilters)] as [number | string, DocCardMeta[]],
      )
      .filter(([, group]) => group.length > 0)
  }, [docsByYear, anyEngagementFilterActive, matchesEngagementFilters])

  const filteredFlat = React.useMemo(() => {
    if (!anyEngagementFilterActive) return filteredDocs
    return filteredDocs.filter(matchesEngagementFilters)
  }, [filteredDocs, anyEngagementFilterActive, matchesEngagementFilters])

  const handleStarToggle = useCallback(
    async (fileId: string) => {
      if (!libraryId || !isLibraryMember || !mutateDoc) return
      const base =
        findDocInGroupedDocs(filteredDocsByYear, fileId) ?? findDocInGroupedDocs(docsByYear, fileId)
      if (!base) return
      if (!base.fileId) return
      const snap = { ...base }
      const nextFav = !(base.isFavorite === true)
      mutateDoc(fileId, (d) => applyFavoriteToggleOptimistic(d, nextFav, selfEmail, selfName))
      try {
        await setUserStarState(fileId, nextFav ? 'favorite' : null)
      } catch {
        mutateDoc(fileId, () => snap)
      }
    },
    [
      libraryId,
      isLibraryMember,
      mutateDoc,
      filteredDocsByYear,
      docsByYear,
      selfEmail,
      selfName,
      setUserStarState,
    ],
  )

  /**
   * Effektive Werte fuer Anzeige + Bulk-Scope. Bei aktivem Favoriten-Filter
   * wird der Server-`totalCount` ignoriert (Server kennt den Filter nicht)
   * und wir reichen die explizite fileId-Liste an die Bulk-Buttons durch.
   */
  const effectiveDocCount = anyEngagementFilterActive
    ? filteredFlat.length
    : (totalCount || filteredDocs.length)
  const effectiveTotalCount = anyEngagementFilterActive ? filteredFlat.length : totalCount
  const explicitBulkFileIds = React.useMemo<string[] | undefined>(() => {
    if (!anyEngagementFilterActive) return undefined
    return filteredFlat
      .map((d) => d.fileId || d.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  }, [anyEngagementFilterActive, filteredFlat])
  const showBulkButtons = isOwner && (
    anyEngagementFilterActive ? filteredFlat.length > 0 : filteredDocs.length > 0
  )
  
  // `doc`-Parameter aus der URL (Auflösung erfolgt nach `allDocs`, siehe unten)
  const docSlug = searchParams?.get('doc')

  const { facetDefs, viewTypes } = useGalleryFacets(libraryId, filters)

  // Graph-Modus (Welle 2): pro Library über config.chat.gallery.graph aktiviert.
  const graphConfig = activeLibrary?.config?.chat?.gallery?.graph
  const graphEnabled = graphConfig?.enabled === true
  // Anzeigenamen je meta-Feld für den Kantenquellen-Selektor (aus Facetten).
  const facetFieldLabels = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const def of facetDefs) {
      if (def.metaKey && def.label) map[def.metaKey] = def.label
    }
    return map
  }, [facetDefs])

  // Fällt der Graph-Modus weg (Config deaktiviert), darf keine 'graph'-Ansicht
  // hängen bleiben — explizit auf 'grid' zurücksetzen (kein stiller Render-Müll).
  React.useEffect(() => {
    if (!graphEnabled && viewMode === 'graph') setViewMode('grid')
  }, [graphEnabled, viewMode])

  // Graph-Modus braucht den GANZEN gefilterten Bestand, nicht nur die per
  // Scroll-Pagination geladenen Seiten (sonst fehlen Knoten unsichtbar).
  // Batchweises Nachladen, der Graph wächst progressiv mit.
  const isGraphActive = viewMode === 'graph' && graphEnabled
  const allGraphDocs = useAllGalleryDocs(filters, debouncedSearchQuery, libraryId, {
    enabled: isGraphActive,
    refreshKey,
  })
  const graphDocs = React.useMemo(() => {
    if (!anyEngagementFilterActive) return allGraphDocs.docs
    return allGraphDocs.docs.filter(matchesEngagementFilters)
  }, [allGraphDocs.docs, anyEngagementFilterActive, matchesEngagementFilters])

  // Owner speichert die aktuelle Graph-Einstellung als Library-Default
  // (config.chat.gallery.graph). Gilt fuer ALLE Nutzer der Library -> nur Owner.
  // chat wird serverseitig flach gemergt -> die VOLLSTAENDIGE gallery senden,
  // damit detailViewType/facets nicht verloren gehen.
  const handleSaveGraphDefault = React.useCallback(async (nextGraph: import('@/types/library').GalleryGraphConfig) => {
    if (!libraryId || !activeLibrary || !isOwner) return
    const existingGallery = (activeLibrary.config?.chat?.gallery ?? {}) as Record<string, unknown>
    const galleryPayload = { ...existingGallery, graph: nextGraph }
    const res = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(sessionHeaders as Record<string, string>) },
      body: JSON.stringify({ id: libraryId, config: { chat: { gallery: galleryPayload } } }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast({ title: t('gallery.graph.saveError'), description: j?.error || res.statusText, variant: 'destructive' })
      return
    }
    setLibraries(libraries.map((l) => l.id === libraryId
      ? ({ ...l, config: { ...l.config, chat: { ...l.config?.chat, gallery: galleryPayload } } } as typeof l)
      : l))
    toast({ title: t('gallery.graph.saved') })
  }, [libraryId, activeLibrary, isOwner, sessionHeaders, setLibraries, libraries, t])

  // Dynamischer Platzhalter für das Suchfeld basierend auf den tatsächlich durchsuchten Feldern
  // Die Suche durchsucht: title, shortTitle + alle String/String[]-Facetten
  const searchPlaceholder = React.useMemo(() => {
    // "Titel" ist immer dabei (fest codiert in der Such-API)
    const fields = [t('gallery.searchFieldTitle') || 'Titel']
    
    // Füge Labels aller durchsuchbaren Facetten hinzu (String/String[] sowie
    // Zahl-Facetten wie massnahme_nr — diese werden serverseitig per $toString
    // durchsucht, siehe docs-Route).
    for (const def of facetDefs) {
      if (def.type === 'string' || def.type === 'string[]' || def.type === 'number' || def.type === 'integer-range') {
        // Verwende das Label, falls vorhanden, sonst den metaKey
        const label = def.label || def.metaKey
        if (label && !fields.includes(label)) {
          fields.push(label)
        }
      }
    }
    
    // Maximal 4 Felder anzeigen, dann "..."
    const displayFields = fields.slice(0, 4)
    const suffix = fields.length > 4 ? ', ...' : ''
    
    return `${t('gallery.searchPrefix') || 'Durchsuchen nach'} ${displayFields.join(', ')}${suffix}`
  }, [facetDefs, t])

  // Lade sources aus QueryLog, falls queryId vorhanden ist
  React.useEffect(() => {
    const queryId = chatReferences?.queryId
    if (!queryId || !libraryId) {
      setSources([])
      return
    }

    let cancelled = false

    async function loadSources() {
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId as string)}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? (sessionHeaders as Record<string, string>) : undefined,
        })
        
        if (!res.ok || cancelled) {
          return
        }
        
        const queryLog = await res.json() as QueryLog
        
        if (cancelled) {
          return
        }
        
        setSources(queryLog.sources || [])
      } catch (error) {
        console.error('[GalleryRoot] Fehler beim Laden der Sources:', error)
        setSources([])
      }
    }

    loadSources()

    return () => {
      cancelled = true
    }
  }, [chatReferences?.queryId, libraryId, sessionHeaders])

  // State für zusätzlich geladene Dokumente aus references
  const [additionalDocs, setAdditionalDocs] = React.useState<DocCardMeta[]>([])

  // Lade fehlende Dokumente aus references nach
  React.useEffect(() => {
    if (!chatReferences?.references || !libraryId || loading) {
      setAdditionalDocs([])
      return
    }
    
    // Extrahiere alle eindeutigen fileIds aus references
    const referencedFileIds = new Set(chatReferences.references.map(ref => ref.fileId))
    
    // Prüfe, welche fileIds bereits in docs vorhanden sind
    const existingFileIds = new Set(docs.map(doc => doc.fileId || doc.id))
    const missingFileIds = Array.from(referencedFileIds).filter(fileId => !existingFileIds.has(fileId))
    
    // Wenn keine fehlenden Dokumente vorhanden sind, nichts tun
    if (missingFileIds.length === 0) {
      setAdditionalDocs([])
      return
    }
    
    let cancelled = false
    
    async function loadMissingDocs() {
      try {
        // Lade fehlende Dokumente über den neuen Endpoint
        const params = new URLSearchParams()
        missingFileIds.forEach(fileId => params.append('fileId', fileId))
        
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs/by-fileids?${params.toString()}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? (sessionHeaders as Record<string, string>) : undefined,
        })
        
        if (!res.ok || cancelled) return
        
        const data = await res.json()
        if (cancelled) return
        
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          setAdditionalDocs(data.items as DocCardMeta[])
        }
      } catch (error) {
        console.error('[GalleryRoot] Fehler beim Nachladen fehlender Dokumente:', error)
        setAdditionalDocs([])
      }
    }
    
    loadMissingDocs()
    
    return () => {
      cancelled = true
    }
  }, [chatReferences?.references, libraryId, docs, loading, sessionHeaders])

  // Kombiniere docs mit additionalDocs für die Gruppierung
  const allDocs = React.useMemo(() => {
    // Entferne Duplikate basierend auf fileId
    const docsMap = new Map<string, DocCardMeta>()
    docs.forEach(doc => {
      const fileId = doc.fileId || doc.id
      if (fileId) docsMap.set(fileId, doc)
    })
    additionalDocs.forEach(doc => {
      const fileId = doc.fileId || doc.id
      if (fileId && !docsMap.has(fileId)) docsMap.set(fileId, doc)
    })
    return Array.from(docsMap.values())
  }, [docs, additionalDocs])

  // Finde aktuelles Dokument aus URL-Parameter (für DetailOverlay).
  // Nutzt `allDocs` (docs + nachgeladene Reference-Docs), damit der `doc`-Parameter auch für
  // Einträge ohne persistierten `meta.slug` funktioniert (synthetischer Slug, siehe document-slug.ts).
  const selectedDoc = React.useMemo(() => {
    if (isSwitchingToStoryModeRef.current) {
      return null
    }
    if (!docSlug || !libraryId || loading || allDocs.length === 0) {
      return null
    }
    return allDocs.find(doc => docMatchesNavigationSlug(doc, docSlug)) || null
  }, [docSlug, libraryId, loading, allDocs])

  /**
   * Geschwister-Dokumente fuer die Pfeil-Navigation in der DetailOverlay.
   * Verwendet die aktuell sichtbare/gefilterte Liste (inkl. Favoriten-
   * Filter und Sort-by-stars), damit die Navigation der Galerie-
   * Anzeigereihenfolge folgt.
   */
  const navigationDocs = React.useMemo(() => {
    return filteredDocsByYear.flatMap(([, group]) => group)
  }, [filteredDocsByYear])
  const { prevDoc, nextDoc } = React.useMemo(() => {
    if (!selectedDoc || navigationDocs.length === 0) return { prevDoc: null, nextDoc: null }
    const targetSlug = getEffectiveDocumentNavigationSlug(selectedDoc)
    const idx = navigationDocs.findIndex((d) => {
      const s = getEffectiveDocumentNavigationSlug(d)
      return s && targetSlug && s === targetSlug
    })
    if (idx < 0) return { prevDoc: null, nextDoc: null }
    return {
      prevDoc: idx > 0 ? navigationDocs[idx - 1] : null,
      nextDoc: idx < navigationDocs.length - 1 ? navigationDocs[idx + 1] : null,
    }
  }, [selectedDoc, navigationDocs])

  // Bestimme viewType für DetailOverlay:
  // - Primär: pro Dokument über `detailViewType` (Wizard/Frontmatter)
  // - Fallback: Library-Config
  const detailViewTypeForDoc = useMemo<TemplatePreviewDetailViewType>(() => {
    // Library-Fallback bestimmen (zentral via util)
    const activeLibraryForFallback = libraries.find(lib => lib.id === libraryId)
    const libraryConfig = activeLibraryForFallback?.config?.chat
    const libraryFallback = getDetailViewType({}, libraryConfig) as TemplatePreviewDetailViewType

    // Wenn kein Dokument ausgewaehlt: nimm den (gerade aktiven) detailViewType der Galerie
    if (!selectedDoc) return detailViewType as TemplatePreviewDetailViewType

    // Helper kuemmert sich um Validierung + 'book'-Fallback (kein silent fallback)
    return resolveDetailViewTypeForDoc(selectedDoc.detailViewType, libraryFallback)
  }, [selectedDoc, detailViewType, libraries, libraryId])

  // Gruppiere Dokumente nach Referenzen, wenn chatReferences gesetzt ist
  // WICHTIG: Verwende `allDocs` statt `docs`, damit alle Dokumente aus references angezeigt werden,
  // auch wenn sie nicht durch Pagination geladen wurden
  // WICHTIG: Führe Gruppierung nur aus, wenn Dokumente geladen sind (nicht während loading)
  const { usedDocs, unusedDocs } = React.useMemo(() => {
    if (!chatReferences || !chatReferences.references || chatReferences.references.length === 0) {
      return { usedDocs: [], unusedDocs: [] }
    }
    
    // Wenn noch geladen wird oder keine Dokumente vorhanden sind, gib leere Arrays zurück
    // Die Gruppierung wird automatisch neu ausgeführt, sobald Dokumente geladen sind
    if (loading || allDocs.length === 0) {
      return { usedDocs: [], unusedDocs: [] }
    }
    
    const result = groupDocsByReferences(allDocs, chatReferences.references, sources)
    return result
  }, [allDocs, chatReferences, sources, loading])
  
  // Event handlers
  // Vereinfachte handleOpenDocument: Nutzt zentrale Utility-Funktion
  const handleOpenDocument = (doc: DocCardMeta) => {
    const slug = getEffectiveDocumentNavigationSlug(doc)
    if (!slug) {
      console.warn('[GalleryRoot] Dokument hat weder slug noch fileId/id, kann nicht geöffnet werden:', doc)
      return
    }
    // Schließe ReferencesSheet bevor DetailOverlay geöffnet wird (verhindert verschachtelte Overlays)
    if (showReferencesSheet) {
      setShowReferencesSheet(false)
      setReferencesSheetMode(null)
      setReferencesSheetData(null)
    }
    // Nutze zentrale Utility-Funktion für URL-basierte Navigation
    openDocumentBySlug(slug, libraryId || '', router, pathname, searchParams)
  }
  
  const handleCloseDocument = () => {
    // Verhindere doppelte Aufrufe
    if (isClosingRef.current) {
      return
    }
    isClosingRef.current = true
    
    // Verwende zentrale Utility-Funktion zum Entfernen des doc-Parameters
    closeDocument(router, pathname, searchParams)
    
    // Reset closing flag nach kurzer Verzögerung
    setTimeout(() => {
      isClosingRef.current = false
    }, 100)
  }
  
  const handleShowReferenceLegend = () => {
    // Auf Mobile: Öffne Sheet statt Desktop-Panel
    if (isMobile) {
      setShowReferencesSheet(true)
      setReferencesSheetMode('answer')
    }
  }
  
  // Koordiniere ReferencesSheet mit DetailOverlay: Schließe Sheet wenn DetailOverlay geöffnet wird (URL-Parameter gesetzt)
  useEffect(() => {
    if (docSlug && showReferencesSheet) {
      setShowReferencesSheet(false)
      setReferencesSheetMode(null)
      setReferencesSheetData(null)
    }
  }, [docSlug, showReferencesSheet])
  
  useGalleryEvents(libraryId, docs, handleOpenDocument, handleShowReferenceLegend)

  // Event-Handler für TOC-Quellenverzeichnis (Mobile)
  React.useEffect(() => {
    const handleShowTOCReferences = (event: Event) => {
      const customEvent = event as CustomEvent<{ libraryId: string }>
      const { libraryId: eventLibraryId } = customEvent.detail || {}
      if (eventLibraryId === libraryId) {
        setShowReferencesSheet(true)
        setReferencesSheetMode('toc')
        setReferencesSheetData(null)
      }
    }
    window.addEventListener('show-toc-references', handleShowTOCReferences)
    return () => window.removeEventListener('show-toc-references', handleShowTOCReferences)
  }, [libraryId])

  // Event-Handler für Antwort-Quellenverzeichnis erweitern (für Mobile)
  // Dieser Handler wird zusätzlich zu useGalleryEvents ausgeführt
  React.useEffect(() => {
    const handleShowAnswerReferences = (event: Event) => {
      const customEvent = event as CustomEvent<{ references: ChatResponse['references']; libraryId: string; queryId?: string }>
      const { references: refs, queryId: eventQueryId, libraryId: eventLibraryId } = customEvent.detail || {}
      if (eventLibraryId === libraryId && refs && refs.length > 0) {
        // Auf Mobile: Öffne Sheet mit den Referenzen
        if (isMobile) {
          setShowReferencesSheet(true)
          setReferencesSheetMode('answer')
          setReferencesSheetData({ references: refs, queryId: eventQueryId })
        }
      }
    }
    window.addEventListener('show-reference-legend', handleShowAnswerReferences)
    return () => window.removeEventListener('show-reference-legend', handleShowAnswerReferences)
  }, [libraryId, isMobile])

  // Synchronisiere chatReferences mit Sheet-Daten (für Mobile)
  React.useEffect(() => {
    if (isMobile && chatReferences && chatReferences.references && chatReferences.references.length > 0) {
      // Wenn chatReferences gesetzt ist und Sheet noch nicht geöffnet ist, aktualisiere die Daten
      if (!showReferencesSheet || referencesSheetMode !== 'answer') {
        setReferencesSheetData({
          references: chatReferences.references,
          queryId: chatReferences.queryId,
        })
      }
    }
  }, [isMobile, chatReferences, showReferencesSheet, referencesSheetMode])

  // Auto-Close bei Moduswechsel: Schließe Antwort-Quellenverzeichnis wenn Story-Modus verlassen wird
  React.useEffect(() => {
    if (mode !== 'story') {
      // Setze chatReferences zurück
      if (chatReferences && chatReferences.references && chatReferences.references.length > 0) {
        const event = new CustomEvent('clear-gallery-filter', {
          detail: {},
        })
        window.dispatchEvent(event)
      }
      // Schließe Sheet falls geöffnet
      if (showReferencesSheet && referencesSheetMode === 'answer') {
        setShowReferencesSheet(false)
        setReferencesSheetMode(null)
        setReferencesSheetData(null)
      }
    }
  }, [mode, chatReferences, showReferencesSheet, referencesSheetMode])

  // Auto-Close bei neuer Frage: Schließe Quellenverzeichnis wenn sich queryId ändert (neue Frage wurde beantwortet)
  React.useEffect(() => {
    const currentQueryId = chatReferences?.queryId
    const prevQueryId = prevQueryIdRef.current
    
    // Wenn sich die queryId ändert (und nicht undefined wird), bedeutet das eine neue Frage wurde beantwortet
    if (currentQueryId && prevQueryId && currentQueryId !== prevQueryId) {
      // Schließe Sheet falls geöffnet
      if (showReferencesSheet && referencesSheetMode === 'answer') {
        setShowReferencesSheet(false)
        setReferencesSheetMode(null)
        setReferencesSheetData(null)
      }
    }
    
    // Aktualisiere prevQueryIdRef
    prevQueryIdRef.current = currentQueryId
  }, [chatReferences?.queryId, showReferencesSheet, referencesSheetMode])

  // Auto-Close bei neuer Frage: Schließe Quellenverzeichnis wenn eine neue Frage gesendet wird (Event-basiert)
  const setChatReferences = useSetAtom(chatReferencesAtom)
  
  React.useEffect(() => {
    const handleNewQuestion = () => {
      // Schließe Sheet falls geöffnet (Mobile)
      if (showReferencesSheet && referencesSheetMode === 'answer') {
        setShowReferencesSheet(false)
        setReferencesSheetMode(null)
        setReferencesSheetData(null)
      }
      
      // Setze chatReferences zurück (Desktop)
      // Dies schließt das Quellenverzeichnis auf Desktop, da es über chatReferences gerendert wird
      setChatReferences({ references: [] })
    }
    
    window.addEventListener('chat-question-sent', handleNewQuestion)
    return () => {
      window.removeEventListener('chat-question-sent', handleNewQuestion)
    }
  }, [showReferencesSheet, referencesSheetMode, setChatReferences])

  // Filter handlers
  const handleClearFilters = () => {
    setFilters({} as Record<string, string[]>)
    
    // Wenn im Story-Modus: Triggere TOC-Neuberechnung
    // Das ChatPanel reagiert auf Filter-Änderungen, aber wir lösen explizit ein Event aus,
    // um sicherzustellen, dass die TOC-Neuberechnung getriggert wird
    if (mode === 'story') {
      window.dispatchEvent(new CustomEvent('gallery-filters-cleared', { 
        detail: { mode: 'story' } 
      }))
    }
  }

  // Event-Handler für "set-gallery-filter" (wird von GroupedItemsGrid verwendet)
  React.useEffect(() => {
    const handleSetGalleryFilter = (event: Event) => {
      const customEvent = event as CustomEvent<{ fileIds: string[] }>
      const { fileIds } = customEvent.detail || {}
      if (fileIds && fileIds.length > 0) {
        // Mappe fileIds zu shortTitles
        const shortTitles = fileIds
          .map(fileId => {
            const doc = docs.find(d => (d.fileId || d.id) === fileId)
            return doc?.shortTitle || doc?.title
          })
          .filter((title): title is string => !!title)
        if (shortTitles.length > 0) {
          setFilters({ shortTitle: shortTitles })
        }
      }
    }
    window.addEventListener('set-gallery-filter', handleSetGalleryFilter)
    return () => window.removeEventListener('set-gallery-filter', handleSetGalleryFilter)
  }, [setFilters, docs])

  // Event-Handler für "clear-gallery-filter" (wird von GroupedItemsGrid verwendet)
  React.useEffect(() => {
    const handleClearGalleryFilter = () => {
      // Entferne shortTitle-Filter, behalte andere Filter
      setFilters(f => {
        const current = f as Record<string, string[] | undefined>
        const next: Record<string, string[]> = {}
        Object.entries(current).forEach(([key, value]) => {
          if (key !== 'shortTitle' && Array.isArray(value) && value.length > 0) {
            next[key] = value
          }
        })
        return next as typeof f
      })
    }
    window.addEventListener('clear-gallery-filter', handleClearGalleryFilter)
    return () => window.removeEventListener('clear-gallery-filter', handleClearGalleryFilter)
  }, [setFilters])

  const setFacet = (name: string, values: string[]) => {
    setFilters(f => {
      const next = { ...(f as Record<string, string[] | undefined>) }
      next[name] = values.length ? values : undefined
      return next as typeof f
    })
  }

  // A4a — Typ-Leitfilter: der gewaehlte Inhaltstyp lebt als Filter `detailViewType`.
  const selectedViewType = (filters as Record<string, string[] | undefined>).detailViewType?.[0] ?? null
  const handleSelectViewType = (vt: string | null) => setFacet('detailViewType', vt ? [vt] : [])

  // Handler für Dokument-Löschung: Trigger Refresh
  const handleDocumentDeleted = React.useCallback(() => {
    // Trigger Refresh durch Änderung des refreshKey
    // Dies führt dazu, dass useGalleryData die Daten neu lädt
    setRefreshKey(prev => prev + 1)
  }, [])

  // Render helpers
  const renderItemsView = () => {
    if (!libraryId) return <div className='text-sm text-muted-foreground'>Keine aktive Bibliothek.</div>
    if (error) return <div className='text-sm text-destructive'>{error}</div>
    if (loading) return <div className='text-sm text-muted-foreground'>Lade Dokumente…</div>
    if (docs.length === 0) {
      return (
        <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
          <div>Keine Dokumente gefunden.</div>
          <Button variant='secondary' onClick={handleClearFilters}>Filter zurücksetzen</Button>
        </div>
      )
    }
    if (filteredDocs.length === 0) {
      return (
        <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
          <div>Keine Dokumente entsprechen den aktuellen Filtern.</div>
          <Button variant='secondary' onClick={handleClearFilters}>Filter zurücksetzen</Button>
        </div>
      )
    }
    if (anyEngagementFilterActive && filteredFlat.length === 0) {
      // Genau ein Filter aktiv -> spezifischer Hinweis; kombiniert -> der
      // klassische Favoriten-Hinweis.
      const commentedOnly = onlyCommentedActive && !onlyStarredActive && !onlyFavoritesActive
      const starredOnly = onlyStarredActive && !onlyCommentedActive && !onlyFavoritesActive
      const emptyHint = commentedOnly
        ? t('gallery.comments.filterEmptyHint', { defaultValue: 'Noch keine Quelle mit Kommentaren.' })
        : starredOnly
          ? t('gallery.favorites.starredEmptyHint', { defaultValue: 'Noch keine Quelle mit Stern.' })
          : t('gallery.favorites.emptyHint', { defaultValue: 'Noch keine Favoriten markiert.' })
      return (
        <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
          <div>{emptyHint}</div>
        </div>
      )
    }
    
    // Graph-Modus (Welle 2): nutzt den KOMPLETTEN gefilterten Bestand
    // (useAllGalleryDocs, batchweise) + Filter-Sidebar. Klick auf einen
    // Knoten öffnet die bestehende DetailOverlay (handleOpenDocument).
    if (viewMode === 'graph' && graphConfig) {
      return (
        <div className='flex h-full flex-col gap-2'>
          {allGraphDocs.error ? (
            <div className='text-sm text-destructive'>
              {t('gallery.graph.loadAllError', { defaultValue: 'Dokumente konnten nicht vollständig geladen werden' })}: {allGraphDocs.error}
            </div>
          ) : allGraphDocs.loading ? (
            <div className='text-sm text-muted-foreground' role='status'>
              {t('gallery.graph.loadingAll', {
                loaded: allGraphDocs.loadedCount,
                total: allGraphDocs.totalCount || '…',
                defaultValue: 'Lade alle Dokumente… {loaded}/{total}',
              })}
            </div>
          ) : allGraphDocs.truncated ? (
            <div className='text-sm text-muted-foreground'>
              {t('gallery.graph.truncatedNotice', {
                loaded: allGraphDocs.loadedCount,
                total: allGraphDocs.totalCount,
                defaultValue: 'Der Graph zeigt die ersten {loaded} von {total} Dokumenten.',
              })}
            </div>
          ) : null}
          {/* Graph erst mounten, wenn ALLE Batches geladen sind: sonst startet
              nach jedem 200er-Batch die D3-Simulation neu und die teure
              Kanten-Berechnung (doc-neighbors) feuert mit wachsender ID-Liste
              mehrfach — bei 606 Docs konkurrierten diese Aggregationen mit dem
              Batch-Loader um DB-Connections (Timeouts, Befund 2026-07-08).
              Bei Fehler zeigen wir den Teilbestand, statt gar nichts. */}
          {!allGraphDocs.loading && graphDocs.length > 0 && (
            <LazyDocGraph
              docs={graphDocs}
              graph={graphConfig}
              onOpenDocument={handleOpenDocument}
              fieldLabels={facetFieldLabels}
              libraryId={libraryId || undefined}
              onSaveDefault={isOwner ? handleSaveGraphDefault : undefined}
              canManageRelations={isOwner}
            />
          )}
        </div>
      )
    }

    // Wenn chatReferences gesetzt ist, verwende gruppierte Ansicht
    if (chatReferences && chatReferences.references && chatReferences.references.length > 0) {
      return (
        <GroupedItemsView
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          usedDocs={usedDocs}
          unusedDocs={unusedDocs}
          references={chatReferences.references}
          sources={sources}
          queryId={chatReferences.queryId}
          libraryId={libraryId || ''}
          onOpenDocument={handleOpenDocument}
          libraryDetailViewType={detailViewType}
          cardDensity={cardDensity}
          onCardDensityChange={handleCardDensityChange}
        />
      )
    }
    
    // Gruppierung basierend auf Konfiguration (Jahr, Kategorie, oder keine).
    // Doc-Translations Refactor: erwartete Ziel-Locales und Reload-Callback nach
    // Publish/Unpublish/Re-translate werden an die Tabelle weitergereicht.
    return <ItemsView 
      viewMode={viewMode} 
      docsByYear={filteredDocsByYear} 
      onOpen={handleOpenDocument} 
      libraryId={libraryId}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onDocumentDeleted={handleDocumentDeleted}
      libraryDetailViewType={detailViewType}
      // Aktive Spalten-Sortierung = flache globale Rangliste ohne Gruppen-Header.
      groupByField={tableSortForApi ? 'none' : groupByField}
      tableColumnFacets={tableColumnFacets}
      cardDensity={cardDensity}
      expectedTargetLocales={activeLibrary?.config?.translations?.targetLocales}
      onPublishChanged={handleDocumentDeleted}
      relationsEnabled={graphConfig?.edgeSources?.relations?.enabled === true}
      sortByStars={sortByStarsActive}
      serverSort={tableSort}
      onServerSortChange={setTableSort}
      onToggleFavorite={handleStarToggle}
      autoApplyConfidenceThreshold={activeLibrary?.config?.autoApplyConfidenceThreshold}
      onGroupClassified={handleDocumentDeleted}
      tableSums={viewMode === 'table' ? tableSums : null}
    />
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Tabs nur rendern, wenn sie nicht im Header sind */}
      {!hideTabs && (
        <div className='mb-3 flex items-center flex-shrink-0'>
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'site' | 'gallery' | 'story')} className="w-auto">
            <TabsList>
              {hasSiteView && (
                <TabsTrigger value="site">{t('explore.homepage')}</TabsTrigger>
              )}
              <TabsTrigger value="gallery">{t('gallery.gallery')}</TabsTrigger>
              <TabsTrigger value="story">{t('gallery.story')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <Tabs value={mode} className="flex-1 min-h-0 flex flex-col">
        {mode === 'site' && hasSiteView && (
        <TabsContent value="site" className="flex-1 min-h-0 m-0 mt-0 flex flex-col overflow-hidden data-[state=active]:flex">
          <iframe
            title={t('explore.homepageFrameTitle')}
            src={siteViewSrc}
            className="h-full w-full min-h-[50vh] rounded-md border bg-background"
            sandbox={siteSandbox}
          />
        </TabsContent>
        )}

        {/* Gallery Mode: nur mounten wenn aktiv, um unnötige API-Last zu vermeiden */}
        {mode === 'gallery' && (
        <TabsContent value="gallery" className="flex-1 min-h-0 m-0 mt-0 flex flex-col overflow-hidden data-[state=active]:flex">
          <GalleryStickyHeader
            headline={texts.headline}
            subtitle={texts.subtitle}
            description={texts.description}
            searchPlaceholder={searchPlaceholder}
            onChangeQuery={(value) => {
              // Entferne Refresh-Suffix beim Setzen des Query-Werts
              setSearchQuery(value.replace(/_refresh_\d+$/, ''))
            }}
            queryValue={searchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            cardDensity={cardDensity}
            onCardDensityChange={handleCardDensityChange}
            showGraph={graphEnabled}
            actions={<CaptureContentButton libraryId={libraryId} />}
          />

          <div className='flex-1 min-h-0 overflow-hidden flex flex-col'>
            {/* Mobile Filter Bar */}
            <div className="lg:hidden">
              <FilterContextBar
                docCount={effectiveDocCount}
                onOpenFilters={() => setShowFilters(true)}
                onClear={handleClearFilters}
                facetDefs={facetDefs}
                ctaLabel={t('gallery.switchToStoryMode')}
                onCta={() => setMode('story')}
                tooltip={t('gallery.storyModeTooltip')}
                mode="gallery"
                viewMode={viewMode}
                filteredDocuments={filteredFlat}
                libraryId={libraryId}
                onBulkDelete={handleDocumentDeleted}
                showBulkDelete={showBulkButtons}
                totalCount={effectiveTotalCount}
                searchQuery={debouncedSearchQuery}
                showBulkPublish={showBulkButtons}
                onBulkPublish={handleDocumentDeleted}
                hasTranslationTargets={(activeLibrary?.config?.translations?.targetLocales?.length ?? 0) > 0}
                explicitBulkFileIds={explicitBulkFileIds}
                relationsEnabled={graphConfig?.edgeSources?.relations?.enabled === true}
              />
            </div>

            {/* Desktop: Grid-Layout. Nur mounten wenn Desktop aktiv — sonst
                laufen Liste/Graph doppelt (CSS versteckt nur die Anzeige,
                Hooks + D3 rechnen trotzdem; Befund 2026-07-08). */}
            {!isMobile && (
            <div className="hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-3 flex-1 min-h-0 overflow-hidden">
              {/* Filters Panel (linke Spalte): Typ-Leitfilter zuerst (A4a), dann Facetten */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                <ViewTypeLeadFilter
                  viewTypes={viewTypes}
                  selected={selectedViewType}
                  onSelect={handleSelectViewType}
                />
                <FiltersPanel
                  facetDefs={facetDefs}
                  selected={filters as Record<string, string[] | undefined>}
                  onChange={setFacet}
                  title={t('gallery.filter')}
                  description={texts.filterDescription}
                />
              </div>

              {/* Items Panel (rechte Spalte) */}
              <div className="flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
                {/* FilterContextBar immer anzeigen - wird nicht mehr durch ReferencesLegend ersetzt */}
                <div className="flex-shrink-0">
                  <FilterContextBar
                    docCount={effectiveDocCount}
                    onOpenFilters={() => setShowFilters(true)}
                    onClear={handleClearFilters}
                    hideFilterButton={true}
                    facetDefs={facetDefs}
                    ctaLabel={t('gallery.switchToStoryMode')}
                    onCta={() => setMode('story')}
                    tooltip={t('gallery.storyModeTooltip')}
                    mode="gallery"
                    viewMode={viewMode}
                    filteredDocuments={filteredFlat}
                    libraryId={libraryId}
                    onBulkDelete={handleDocumentDeleted}
                    showBulkDelete={showBulkButtons}
                    totalCount={effectiveTotalCount}
                    searchQuery={debouncedSearchQuery}
                    showBulkPublish={showBulkButtons}
                    onBulkPublish={handleDocumentDeleted}
                    hasTranslationTargets={(activeLibrary?.config?.translations?.targetLocales?.length ?? 0) > 0}
                    explicitBulkFileIds={explicitBulkFileIds}
                    relationsEnabled={graphConfig?.edgeSources?.relations?.enabled === true}
                  />
                </div>

                <section
                  className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                  data-gallery-section
                >
                  <div className="min-w-0">{renderItemsView()}</div>
                </section>
              </div>
            </div>
            )}

            {/* Mobile: Items View. Gegenstueck zum Desktop-Mount oben. */}
            {isMobile && (
            <section className="lg:hidden w-full min-w-0 flex flex-col min-h-0 flex-1" data-gallery-section>
              {/* viewportClassName ueberschreibt Radix' internes display:table am
                  Inhalts-Wrapper -> block + volle Breite, damit der Tabellen-eigene
                  overflow-auto-Container horizontal scrollt statt auf 760px aufzublaehen. */}
              <ScrollArea className="flex-1 min-h-0" viewportClassName="[&>div]:!block">
                <div className="pr-4 min-w-0">{renderItemsView()}</div>
              </ScrollArea>
            </section>
            )}
          </div>
        </TabsContent>
        )}

        {/* Story Mode: Chat/Story nur on-demand mounten */}
        {mode === 'story' && (
        <TabsContent value="story" className="flex-1 min-h-0 m-0 flex flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
          <div className="flex-shrink-0">
            <StoryModeHeader libraryId={libraryId || ''} onBackToGallery={() => setMode('gallery')} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] flex-1 min-h-0 overflow-hidden">
            <div className="min-h-0 flex flex-col overflow-hidden rounded-md">
              <LazyChatPanel libraryId={libraryId} variant='embedded' />
            </div>
            {/* Nur auf Desktop mounten — auf Mobil war die Spalte bisher nur
                CSS-versteckt und hat Liste/Hooks trotzdem doppelt betrieben. */}
            {!isMobile && (
            <div className="hidden lg:flex flex-col min-h-0 overflow-hidden rounded-md">
              {/* FilterContextBar nur anzeigen wenn KEINE Antwort-Referenzen angezeigt werden (Answer-Modus) */}
              {!(chatReferences && chatReferences.references && chatReferences.references.length > 0) && (
                <div className="flex-shrink-0">
                  <FilterContextBar
                    docCount={effectiveDocCount}
                    onOpenFilters={() => setShowFilters(true)}
                    onClear={handleClearFilters}
                    hideFilterButton={true}
                    facetDefs={facetDefs}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    cardDensity={cardDensity}
                    onCardDensityChange={handleCardDensityChange}
                    mode="story"
                  />
                </div>
              )}
              {/* ReferencesLegend wird nicht mehr angezeigt, wenn chatReferences gesetzt ist (wird durch GroupedItemsGrid ersetzt) */}
              <section
                className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                data-gallery-section
              >
                <div>{renderItemsView()}</div>
              </section>
            </div>
            )}
          </div>
        </TabsContent>
        )}
      </Tabs>

      {/* Mobile Filters Sheet */}
      <MobileFiltersSheet
        open={showFilters && isMobile}
        onOpenChange={(open) => setShowFilters(open && isMobile)}
        facetDefs={facetDefs}
        selected={filters as Record<string, string[] | undefined>}
        onChange={setFacet}
        title={t('gallery.filter')}
        description={texts.filterDescription}
        viewTypes={viewTypes}
        selectedViewType={selectedViewType}
        onSelectViewType={handleSelectViewType}
      />

      {/* Detail Overlay - reagiert nur auf URL-Parameter */}
      {selectedDoc && (
        <DetailOverlay
          open={!!selectedDoc}
          onClose={handleCloseDocument}
          libraryId={libraryId || ''}
          fileId={selectedDoc.fileId || selectedDoc.id}
          viewType={detailViewTypeForDoc}
          doc={selectedDoc}
          currentMode={galleryDataMode}
          isSwitchingRef={isSwitchingToStoryModeRef}
          // Fallback-Locale aus Library-Config (siehe Doc-Translations Refactor)
          fallbackLocale={activeLibrary?.config?.translations?.fallbackLocale}
          prevDoc={prevDoc}
          nextDoc={nextDoc}
          onNavigateToDoc={handleOpenDocument}
          siblingDocs={navigationDocs}
          onToggleFavorite={handleStarToggle}
        />
      )}

      {/* References Sheet für Mobile */}
      {showReferencesSheet && referencesSheetMode && libraryId && (
        <ReferencesSheet
          open={showReferencesSheet}
          onOpenChange={(open) => {
            setShowReferencesSheet(open)
            if (!open) {
              setReferencesSheetMode(null)
              setReferencesSheetData(null)
            }
          }}
          libraryId={libraryId}
          mode={referencesSheetMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          cardDensity={cardDensity}
          onCardDensityChange={handleCardDensityChange}
          references={referencesSheetData?.references}
          queryId={referencesSheetData?.queryId}
          onOpenDocument={handleOpenDocument}
          onClearFilters={handleClearFilters}
          // Props für TOC-Modus
          filteredDocs={filteredDocs}
          docsByYear={docsByYear}
          // Props für Answer-Modus
          usedDocs={usedDocs}
          unusedDocs={unusedDocs}
          sources={sources}
          // Loading und Error States
          loading={loading}
          error={error}
        />
      )}
    </div>
  )
}
