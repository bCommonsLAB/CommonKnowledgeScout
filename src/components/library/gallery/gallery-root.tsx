'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
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
import { ReferencesLegend } from '@/components/library/gallery/references-legend'
import { MobileFiltersSheet } from '@/components/library/gallery/mobile-filters-sheet'
import { DetailOverlay } from '@/components/library/gallery/detail-overlay'
import { useGalleryMode } from '@/hooks/gallery/use-gallery-mode'
import { useGalleryConfig } from '@/hooks/gallery/use-gallery-config'
import { useGalleryData } from '@/hooks/gallery/use-gallery-data'
import { useGalleryFacets } from '@/hooks/gallery/use-gallery-facets'
import { useGalleryEvents } from '@/hooks/gallery/use-gallery-events'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  const [showReferenceLegend, setShowReferenceLegend] = useState(false)
  const [selected, setSelected] = useState<DocCardMeta | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const chatReferences = useAtomValue(chatReferencesAtom)
  const setChatReferences = useSetAtom(chatReferencesAtom)

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

  // Event handlers
  const handleOpenDocument = (doc: DocCardMeta) => setSelected(doc)
  const handleShowReferenceLegend = () => setShowReferenceLegend(true)
  useGalleryEvents(libraryId, docs, handleOpenDocument, handleShowReferenceLegend)

  // Filter handlers
  const handleClearFilters = () => {
    if (filters.fileId && Array.isArray(filters.fileId) && filters.fileId.length > 0) {
      setShowReferenceLegend(false)
    }
    setFilters({} as Record<string, string[]>)
  }

  const handleCloseReferenceLegend = () => {
    setShowReferenceLegend(false)
    setChatReferences([])
    setFilters(f => {
      const current = f as Record<string, string[] | undefined>
      const next: Record<string, string[]> = {}
      Object.entries(current).forEach(([key, value]) => {
        if (key !== 'fileId' && Array.isArray(value) && value.length > 0) {
          next[key] = value
        }
      })
      return next as typeof f
    })
  }

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
    return <ItemsGrid docsByYear={docsByYear} onOpen={handleOpenDocument} />
  }

  return (
    <div ref={containerRef} className="h-full overflow-hidden flex flex-col">
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
            ctaLabel={t('gallery.switchToStoryMode')}
            onCta={() => setMode('story')}
            tooltip={t('gallery.storyModeTooltip')}
          />

          <div className='flex-1 min-h-0 overflow-hidden flex flex-col min-h-[80vh]'>
            {/* Mobile Filter Bar */}
            <div className="lg:hidden">
              <FilterContextBar
                docCount={filteredDocs.length}
                onOpenFilters={() => setShowFilters(true)}
                onClear={handleClearFilters}
                showReferenceLegend={showReferenceLegend}
                facetDefs={facetDefs}
              />
            </div>

            {/* Desktop: Grid-Layout */}
            <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 flex-1 min-h-0 overflow-hidden min-h-[80vh]">
              {/* Filters Panel */}
              <FiltersPanel
                facetDefs={facetDefs}
                selected={filters as Record<string, string[] | undefined>}
                onChange={setFacet}
                title={t('gallery.filter')}
                description={texts.filterDescription}
              />

              {/* Items Panel */}
              <div className="flex flex-col min-h-0 overflow-hidden h-full">
                {!showReferenceLegend && (
                  <div className="flex-shrink-0">
                    <FilterContextBar
                      docCount={filteredDocs.length}
                      onOpenFilters={() => setShowFilters(true)}
                      onClear={handleClearFilters}
                      showReferenceLegend={showReferenceLegend}
                      hideFilterButton={true}
                      facetDefs={facetDefs}
                    />
                  </div>
                )}

                <section
                  className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                  data-gallery-section
                  onWheel={(e: React.WheelEvent<HTMLElement>) => {
                    const target = e.currentTarget
                    if (target.scrollHeight > target.clientHeight) {
                      const { scrollTop, scrollHeight, clientHeight } = target
                      const deltaY = e.deltaY
                      const isAtTop = scrollTop <= 0
                      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1
                      if ((deltaY > 0 && isAtBottom) || (deltaY < 0 && isAtTop)) {
                        e.stopPropagation()
                      }
                    }
                  }}
                >
                  <div>{renderItemsGrid()}</div>
                </section>
              </div>
            </div>

            {/* Mobile: Items Grid */}
            <section className="lg:hidden w-full flex flex-col min-h-0 h-full" data-gallery-section>
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
              <div className="flex-shrink-0 px-4 py-3 border-b bg-background">
                <h3 className="text-sm font-medium text-muted-foreground">{t('gallery.storyModeGalleryDescription')}</h3>
              </div>
              {!showReferenceLegend && (
                <div className="flex-shrink-0">
                  <FilterContextBar
                    docCount={filteredDocs.length}
                    onOpenFilters={() => setShowFilters(true)}
                    onClear={handleClearFilters}
                    showReferenceLegend={showReferenceLegend}
                    hideFilterButton={true}
                    facetDefs={facetDefs}
                  />
                </div>
              )}
              {showReferenceLegend && chatReferences && chatReferences.length > 0 && (
                <ReferencesLegend
                  references={chatReferences}
                  libraryId={libraryId || ''}
                  onClose={handleCloseReferenceLegend}
                  onOpenDocument={(fileId) => {
                    const doc = docs.find(d => d.id === fileId)
                    if (doc) handleOpenDocument(doc)
                  }}
                  title={t('gallery.references')}
                  description={t('gallery.referencesDescription')}
                />
              )}
              <section
                className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                data-gallery-section
                onWheel={(e: React.WheelEvent<HTMLElement>) => {
                  const target = e.currentTarget
                  if (target.scrollHeight > target.clientHeight) {
                    const { scrollTop, scrollHeight, clientHeight } = target
                    const deltaY = e.deltaY
                    const isAtTop = scrollTop <= 0
                    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1
                    if ((deltaY > 0 && isAtBottom) || (deltaY < 0 && isAtTop)) {
                      e.stopPropagation()
                    }
                  }
                }}
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
      />

      {/* Detail Overlay */}
      {selected && (
        <DetailOverlay
          open={!!selected}
          onClose={() => setSelected(null)}
          libraryId={libraryId || ''}
          fileId={selected.fileId || selected.id}
          viewType={detailViewType}
          title={t('gallery.documentDetails')}
        />
      )}
    </div>
  )
}
