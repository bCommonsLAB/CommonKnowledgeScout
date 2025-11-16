'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterContextBar } from '@/components/library/filter-context-bar'
import { ChatPanel } from '@/components/library/chat/chat-panel'
import { StoryModeHeader } from '@/components/library/story/story-mode-header'
import { GalleryStickyHeader } from '@/components/library/gallery/gallery-sticky-header'
import { FiltersPanel } from '@/components/library/gallery/filters-panel'
import { ItemsGrid } from '@/components/library/gallery/items-grid'
import { GroupedItemsGrid } from '@/components/library/gallery/grouped-items-grid'
import { groupDocsByReferences } from '@/hooks/gallery/use-gallery-data'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import type { QueryLog } from '@/types/query-log'
import type { ChatResponse } from '@/types/chat-response'
import { MobileFiltersSheet } from '@/components/library/gallery/mobile-filters-sheet'
import { DetailOverlay } from '@/components/library/gallery/detail-overlay'
import { useGalleryMode } from '@/hooks/gallery/use-gallery-mode'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useStoryContext } from '@/hooks/use-story-context'
import { useGalleryConfig } from '@/hooks/gallery/use-gallery-config'
import { useGalleryData } from '@/hooks/gallery/use-gallery-data'
import { useGalleryFacets } from '@/hooks/gallery/use-gallery-facets'
import { useGalleryEvents } from '@/hooks/gallery/use-gallery-events'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ReferencesSheet } from './references-sheet'

export interface GalleryRootProps {
  libraryIdProp?: string
  /** Wenn true, werden die Tabs nicht gerendert (z.B. wenn sie bereits im Header sind) */
  hideTabs?: boolean
}

export function GalleryRoot({ libraryIdProp, hideTabs = false }: GalleryRootProps) {
  const { t } = useTranslation()
  const libraryIdFromAtom = useAtomValue(activeLibraryIdAtom)
  const libraryId = libraryIdProp || libraryIdFromAtom
  const libraries = useAtomValue(librariesAtom)
  const [filters, setFilters] = useAtom(galleryFiltersAtom)
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<DocCardMeta | null>(null)
  const isClosingRef = React.useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const chatReferences = useAtomValue(chatReferencesAtom)
  const [showReferencesSheet, setShowReferencesSheet] = useState(false)
  const [referencesSheetMode, setReferencesSheetMode] = useState<'answer' | 'toc' | null>(null)
  const [referencesSheetData, setReferencesSheetData] = useState<{
    references?: ChatResponse['references']
    queryId?: string
  } | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sessionHeaders = useSessionHeaders()
  const [sources, setSources] = React.useState<QueryLog['sources']>([])
  
  // Story Context für Perspektivenprüfung
  const { character } = useStoryContext()

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Lade detailViewType direkt aus dem librariesAtom, um Flackern zu vermeiden
  const activeLibrary = libraries.find(lib => lib.id === libraryId)
  const initialDetailViewType = useMemo(() => {
    const galleryConfig = activeLibrary?.config?.chat?.gallery
    const vt = galleryConfig?.detailViewType
    const result = (vt === 'book' || vt === 'session') ? vt : 'book'
    console.log('[GalleryRoot] initialDetailViewType:', {
      libraryId,
      detailViewType: vt,
      result,
      galleryConfig: JSON.stringify(galleryConfig),
    })
    return result
  }, [activeLibrary?.config?.chat?.gallery, libraryId])

  // Hooks
  const { mode, setMode, containerRef } = useGalleryMode()
  
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
        }
        // Für normale Library-Seiten können wir später eine Route hinzufügen
        // Aktuell nur für explore-Seiten implementiert
      }
    }
  }, [mode, character, pathname, router])
  // useGalleryConfig verwendet jetzt direkt die Übersetzungen basierend auf detailViewType
  // initialDetailViewType verhindert das Flackern beim ersten Render
  const { texts, detailViewType } = useGalleryConfig(
    { headline: '', subtitle: '', description: '', filterDescription: '' }, 
    libraryId,
    initialDetailViewType
  )
  
  // Debug: Logge detailViewType wenn sich selected ändert
  useEffect(() => {
    if (selected) {
      console.log('[GalleryRoot] DetailOverlay wird geöffnet:', {
        fileId: selected.fileId || selected.id,
        detailViewType,
        initialDetailViewType,
        activeLibraryId: activeLibrary?.id,
        galleryConfig: activeLibrary?.config?.chat?.gallery,
        fullLibraryConfig: JSON.stringify(activeLibrary?.config?.chat, null, 2),
      })
    }
  }, [selected, detailViewType, initialDetailViewType, activeLibrary])
  const { docs, loading, error, filteredDocs, docsByYear } = useGalleryData(filters, mode, searchQuery, libraryId)
  const { facetDefs } = useGalleryFacets(libraryId, filters)

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

  // Gruppiere Dokumente nach Referenzen, wenn chatReferences gesetzt ist
  const { usedDocs, unusedDocs } = React.useMemo(() => {
    if (!chatReferences || !chatReferences.references || chatReferences.references.length === 0) {
      return { usedDocs: [], unusedDocs: [] }
    }
    return groupDocsByReferences(filteredDocs, chatReferences.references, sources)
  }, [filteredDocs, chatReferences, sources])
  
  // Ref, um zu verhindern, dass die Slug-Suche mehrfach ausgeführt wird
  const slugSearchRef = React.useRef<{ slug: string; libraryId: string; docsCount: number } | null>(null)
  
  // Lade Dokument aus URL-Slug, falls vorhanden
  // Strategie: Warte bis docs geladen sind, dann suche im Frontend nach dem slug
  useEffect(() => {
    const docSlug = searchParams?.get('doc')
    
    // Wenn kein doc-Parameter in URL, aber Overlay offen ist, schließe es
    if (!docSlug && selected && pathname?.startsWith('/explore/')) {
      setSelected(null)
      return
    }
    
    // Prüfe Bedingungen für Slug-Suche
    if (!docSlug || !libraryId || loading || docs.length === 0 || selected) {
      return
    }
    
    // Prüfe, ob wir bereits nach diesem Slug gesucht haben (mit denselben docs)
    const searchKey = { slug: docSlug, libraryId, docsCount: docs.length }
    if (
      slugSearchRef.current &&
      slugSearchRef.current.slug === searchKey.slug &&
      slugSearchRef.current.libraryId === searchKey.libraryId &&
      slugSearchRef.current.docsCount === searchKey.docsCount
    ) {
      // Bereits gesucht, überspringe
      return
    }
    
    // Markiere, dass Suche gestartet wird
    slugSearchRef.current = searchKey
    
    // Finde Dokument anhand des Slugs im Frontend
    // OPTIMIERUNG: Verwende bereits geladene slug-Daten aus docs, keine API-Calls nötig
    const findDocBySlug = () => {
      console.log('[GalleryRoot] Suche Dokument mit slug im Frontend:', { 
        slug: docSlug, 
        libraryId,
        docsCount: docs.length,
      })
      
      // Durchsuche alle docs und prüfe den bereits geladenen slug
      const foundDoc = docs.find(doc => doc.slug === docSlug)
      
      if (foundDoc) {
        console.log('[GalleryRoot] ✅ Dokument mit slug gefunden:', { 
          slug: docSlug, 
          fileId: foundDoc.fileId || foundDoc.id,
          doc: foundDoc,
        })
        setSelected(foundDoc)
      } else {
        console.warn('[GalleryRoot] ⚠️ Dokument mit slug nicht gefunden:', { 
          slug: docSlug,
          docsCount: docs.length,
        })
      }
    }
    
    findDocBySlug()
  }, [searchParams, libraryId, docs, loading, selected, pathname])
  
  // Reset slugSearchRef, wenn selected geändert wird (Overlay geschlossen)
  useEffect(() => {
    if (!selected) {
      slugSearchRef.current = null
    }
  }, [selected])

  // Ref, um zu verhindern, dass Dokument mehrfach geöffnet wird
  const openingDocRef = React.useRef<string | null>(null)
  
  // Event handlers
  const handleOpenDocument = (doc: DocCardMeta) => {
    const docId = doc.fileId || doc.id
    // Verhindere mehrfaches Öffnen desselben Dokuments
    if (openingDocRef.current === docId || (selected && (selected.fileId || selected.id) === docId)) {
      return
    }
    openingDocRef.current = docId
    
    setSelected(doc)
    
    // URL aktualisieren mit slug, falls vorhanden
    // OPTIMIERUNG: Verwende bereits geladenen slug aus doc, keine API-Calls nötig
    if (pathname && pathname.startsWith('/explore/') && doc.slug) {
      try {
        // Extrahiere library-slug aus pathname
        const librarySlugMatch = pathname.match(/\/explore\/([^/]+)/)
        if (librarySlugMatch && librarySlugMatch[1]) {
          const librarySlug = librarySlugMatch[1]
          const params = new URLSearchParams(searchParams?.toString() || '')
          params.set('doc', doc.slug)
          router.replace(`/explore/${librarySlug}?${params.toString()}`, { scroll: false })
        }
      } catch (err) {
        console.error('[GalleryRoot] Fehler beim Aktualisieren der URL:', err)
      }
    }
    
    // Reset opening flag nach kurzer Verzögerung
    setTimeout(() => {
      openingDocRef.current = null
    }, 200)
  }
  
  const handleCloseDocument = () => {
    // Verhindere doppelte Aufrufe
    if (isClosingRef.current) {
      return
    }
    isClosingRef.current = true
    
    setSelected(null)
    openingDocRef.current = null // Reset opening flag beim Schließen
    
    // URL bereinigen: doc-Parameter entfernen
    if (pathname && pathname.startsWith('/explore/')) {
      const librarySlugMatch = pathname.match(/\/explore\/([^/]+)/)
      if (librarySlugMatch && librarySlugMatch[1]) {
        const librarySlug = librarySlugMatch[1]
        const params = new URLSearchParams(searchParams?.toString() || '')
        params.delete('doc')
        const newUrl = params.toString() ? `/explore/${librarySlug}?${params.toString()}` : `/explore/${librarySlug}`
        router.replace(newUrl, { scroll: false })
      }
    }
    
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

  // Render helpers
  const renderItemsGrid = () => {
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
    
    // Wenn chatReferences gesetzt ist, verwende GroupedItemsGrid
    if (chatReferences && chatReferences.references && chatReferences.references.length > 0) {
      return (
        <GroupedItemsGrid
          usedDocs={usedDocs}
          unusedDocs={unusedDocs}
          references={chatReferences.references}
          sources={sources}
          queryId={chatReferences.queryId}
          libraryId={libraryId || ''}
          onOpenDocument={handleOpenDocument}
        />
      )
    }
    
    // Sonst normale Jahrgangs-Gruppierung
    return <ItemsGrid docsByYear={docsByYear} onOpen={handleOpenDocument} />
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Tabs nur rendern, wenn sie nicht im Header sind */}
      {!hideTabs && (
        <div className='mb-6 flex items-center flex-shrink-0'>
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'gallery' | 'story')} className="w-auto">
            <TabsList>
              <TabsTrigger value="gallery">{t('gallery.gallery')}</TabsTrigger>
              <TabsTrigger value="story">{t('gallery.story')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <Tabs value={mode} className="flex-1 min-h-0 flex flex-col">
        {/* Gallery Mode */}
        <TabsContent value="gallery" className="flex-1 min-h-0 m-0 flex flex-col overflow-hidden data-[state=active]:flex">
          <GalleryStickyHeader
            headline={texts.headline}
            subtitle={texts.subtitle}
            description={texts.description}
            searchPlaceholder={t('gallery.searchPlaceholder')}
            onChangeQuery={setSearchQuery}
            queryValue={searchQuery}
          />

          <div className='flex-1 min-h-0 overflow-hidden flex flex-col min-h-[80vh]'>
            {/* Mobile Filter Bar */}
            <div className="lg:hidden">
              <FilterContextBar
                docCount={filteredDocs.length}
                onOpenFilters={() => setShowFilters(true)}
                onClear={handleClearFilters}
                facetDefs={facetDefs}
                ctaLabel={t('gallery.switchToStoryMode')}
                onCta={() => setMode('story')}
                tooltip={t('gallery.storyModeTooltip')}
              />
            </div>

            {/* Desktop: Grid-Layout */}
            <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 flex-1 min-h-0 overflow-hidden min-h-[80vh]">
              {/* Filters Panel (linke Spalte) */}
              <FiltersPanel
                facetDefs={facetDefs}
                selected={filters as Record<string, string[] | undefined>}
                onChange={setFacet}
                title={t('gallery.filter')}
                description={texts.filterDescription}
                docs={docs}
              />

              {/* Items Panel (rechte Spalte) */}
              <div className="flex flex-col min-h-0 overflow-hidden flex-1">
                {/* FilterContextBar immer anzeigen - wird nicht mehr durch ReferencesLegend ersetzt */}
                <div className="flex-shrink-0">
                  <FilterContextBar
                    docCount={filteredDocs.length}
                    onOpenFilters={() => setShowFilters(true)}
                    onClear={handleClearFilters}
                    hideFilterButton={true}
                    facetDefs={facetDefs}
                    ctaLabel={t('gallery.switchToStoryMode')}
                    onCta={() => setMode('story')}
                    tooltip={t('gallery.storyModeTooltip')}
                  />
                </div>

                <section
                  className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                  data-gallery-section
                >
                  <div>{renderItemsGrid()}</div>
                </section>
              </div>
            </div>

            {/* Mobile: Items Grid */}
            <section className="lg:hidden w-full flex flex-col min-h-0 flex-1" data-gallery-section>
              <ScrollArea className="flex-1 min-h-0">
                <div className="pr-4">{renderItemsGrid()}</div>
              </ScrollArea>
            </section>
          </div>
        </TabsContent>

        {/* Story Mode */}
        <TabsContent value="story" className="flex-1 min-h-0 m-0 flex flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden">
          <div className="flex-shrink-0">
            <StoryModeHeader libraryId={libraryId || ''} onBackToGallery={() => setMode('gallery')} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] flex-1 min-h-0 overflow-hidden">
            <div className="min-h-0 flex flex-col overflow-hidden rounded-md">
              <ChatPanel libraryId={libraryId} variant='embedded' />
            </div>
            <div className="hidden lg:flex flex-col min-h-0 overflow-hidden rounded-md">
              {/* FilterContextBar nur anzeigen wenn KEINE Antwort-Referenzen angezeigt werden (Answer-Modus) */}
              {!(chatReferences && chatReferences.references && chatReferences.references.length > 0) && (
                <div className="flex-shrink-0">
                  <FilterContextBar
                    docCount={filteredDocs.length}
                    onOpenFilters={() => setShowFilters(true)}
                    onClear={handleClearFilters}
                    hideFilterButton={true}
                    facetDefs={facetDefs}
                  />
                </div>
              )}
              {/* ReferencesLegend wird nicht mehr angezeigt, wenn chatReferences gesetzt ist (wird durch GroupedItemsGrid ersetzt) */}
              <section
                className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                data-gallery-section
              >
                <div>{renderItemsGrid()}</div>
              </section>
            </div>
          </div>
        </TabsContent>
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
        docs={docs}
      />

      {/* Detail Overlay */}
      {selected && (
        <DetailOverlay
          open={!!selected}
          onClose={handleCloseDocument}
          libraryId={libraryId || ''}
          fileId={selected.fileId || selected.id}
          viewType={detailViewType}
          onSwitchToStoryMode={() => {
            // Setze shortTitle-Filter für das aktuelle Dokument
            setFilters(f => {
              const next = { ...(f as Record<string, string[] | undefined>) }
              const docShortTitle = selected.shortTitle || selected.title
              next.shortTitle = docShortTitle ? [docShortTitle] : undefined
              return next as typeof f
            })
            handleCloseDocument()
            setMode('story')
          }}
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
          references={referencesSheetData?.references}
          queryId={referencesSheetData?.queryId}
          onOpenDocument={handleOpenDocument}
          onClearFilters={handleClearFilters}
        />
      )}
    </div>
  )
}
