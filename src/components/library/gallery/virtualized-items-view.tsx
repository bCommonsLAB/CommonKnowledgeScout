'use client'

import React, { useRef, useEffect } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/hooks'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'
import type { ViewMode } from './gallery-sticky-header'
import { ItemsGrid } from './items-grid'
import { DeleteDocumentButton } from './delete-document-button'
import { useIsLibraryOwner } from '@/hooks/gallery/use-is-library-owner'
import { formatUpsertedAt } from '@/utils/format-upserted-at'

export interface VirtualizedItemsViewProps {
  viewMode: ViewMode
  docsByYear: Array<[number | string, DocCardMeta[]]>
  onOpen?: (doc: DocCardMeta) => void
  libraryId?: string
  onLoadMore?: () => void
  hasMore?: boolean
  isLoadingMore?: boolean
  /** Callback nach erfolgreichem Löschen eines Dokuments */
  onDocumentDeleted?: () => void
  /** Fallback-DetailViewType aus der Library-Config */
  libraryDetailViewType?: string
}

export function VirtualizedItemsView({
  viewMode,
  docsByYear,
  onOpen,
  libraryId,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onDocumentDeleted,
  libraryDetailViewType,
}: VirtualizedItemsViewProps) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isOwner } = useIsLibraryOwner(libraryId)
  const parentRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollOffsetFromBottomRef = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const prevDocsLengthRef = useRef<number>(0)

  // Finde den Scroll-Container einmal beim Mount
  useEffect(() => {
    const scrollContainer = parentRef.current?.closest('[data-gallery-section]') as HTMLElement | null
    scrollContainerRef.current = scrollContainer
  }, [])

  // Speichere Scroll-Offset vom Ende vor dem Laden neuer Daten
  useEffect(() => {
    if (isLoadingMore && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      scrollOffsetFromBottomRef.current = container.scrollHeight - container.scrollTop
      prevDocsLengthRef.current = docsByYear.reduce((sum, [, docs]) => sum + docs.length, 0)
    }
  }, [isLoadingMore, docsByYear])

  // Stelle Scroll-Position nach dem Laden wieder her (relativ zum Ende)
  useEffect(() => {
    if (!isLoadingMore && scrollContainerRef.current && scrollOffsetFromBottomRef.current !== null) {
      const currentDocsLength = docsByYear.reduce((sum, [, docs]) => sum + docs.length, 0)
      
      // Nur wiederherstellen, wenn neue Items hinzugefügt wurden
      if (currentDocsLength > prevDocsLengthRef.current) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current && scrollOffsetFromBottomRef.current !== null) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight
            scrollContainerRef.current.scrollTop = newScrollHeight - scrollOffsetFromBottomRef.current
            scrollOffsetFromBottomRef.current = null
          }
        })
      }
    }
  }, [isLoadingMore, docsByYear])

  // Infinite Scroll: Beobachte Sentinel-Element
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoadingMore || !onLoadMore) return

    const scrollContainer = scrollContainerRef.current || parentRef.current

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          // Speichere Scroll-Offset vom Ende vor dem Laden
          if (scrollContainer) {
            scrollOffsetFromBottomRef.current = scrollContainer.scrollHeight - scrollContainer.scrollTop
            prevDocsLengthRef.current = docsByYear.reduce((sum, [, docs]) => sum + docs.length, 0)
          }
          onLoadMore()
        }
      },
      {
        root: scrollContainer,
        rootMargin: '300px', // Lade früher, wenn noch 300px bis zum Ende
        threshold: 0.1,
      }
    )

    observer.observe(sentinelRef.current)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, isLoadingMore, onLoadMore, docsByYear])

  const handleRowClick = (doc: DocCardMeta) => {
    if (doc.slug && libraryId) {
      openDocumentBySlug(doc.slug, libraryId, router, pathname, searchParams)
    } else if (onOpen) {
      onOpen(doc)
    }
  }

  const formatSpeakers = (doc: DocCardMeta): string => {
    if (Array.isArray(doc.speakers) && doc.speakers.length > 0) {
      return doc.speakers.length === 1
        ? doc.speakers[0]
        : `${doc.speakers[0]} +${doc.speakers.length - 1}`
    }
    if (Array.isArray(doc.authors) && doc.authors.length > 0) {
      return doc.authors.length === 1
        ? doc.authors[0]
        : `${doc.authors[0]} +${doc.authors.length - 1}`
    }
    return '-'
  }

  // Grid-Modus: Einfaches Infinite Scroll ohne vollständige Virtualisierung (wegen unterschiedlicher Card-Höhen)
  if (viewMode === 'grid') {
    return (
      <div ref={parentRef}>
        <ItemsGrid docsByYear={docsByYear} onOpen={onOpen} libraryId={libraryId} libraryDetailViewType={libraryDetailViewType} />
        {/* Sentinel für Infinite Scroll */}
        {hasMore && (
          <div ref={sentinelRef} className="h-20 flex items-center justify-center py-4">
            {isLoadingMore ? (
              <span className="text-sm text-muted-foreground">Lade weitere Dokumente...</span>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  // Table-Modus: Einfaches Infinite Scroll (Virtualisierung bei Tabellen ist komplexer wegen Jahr-Gruppierung)
  return (
    <div ref={parentRef}>
      {docsByYear.map(([year, yearDocs]) => (
        <div key={year} className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            {year === 'Ohne Jahrgang' ? t('gallery.noYear') : t('gallery.year', { year })}
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">{t('gallery.table.title')}</TableHead>
                  <TableHead className="w-[15%]">{t('gallery.table.year')}</TableHead>
                  <TableHead className="w-[15%]">{t('gallery.table.track')}</TableHead>
                  <TableHead className="w-[20%] whitespace-nowrap">{t('gallery.table.upsertedAt')}</TableHead>
                  {isOwner && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearDocs.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(doc)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span className="line-clamp-2">
                          {doc.shortTitle || doc.title || doc.fileName || 'Dokument'}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {formatSpeakers(doc)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.year ? (
                        <Badge variant="secondary" className="text-xs">
                          {String(doc.year)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.track ? (
                        <Badge variant="outline" className="text-xs">
                          {doc.track}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      <span title={doc.upsertedAt ?? ''}>
                        {formatUpsertedAt(doc.upsertedAt, { locale })}
                      </span>
                    </TableCell>
                    {isOwner && libraryId && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DeleteDocumentButton
                          doc={doc}
                          libraryId={libraryId}
                          onDeleted={onDocumentDeleted}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
      {/* Sentinel für Infinite Scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="h-20 flex items-center justify-center py-4">
          {isLoadingMore ? (
            <span className="text-sm text-muted-foreground">Lade weitere Dokumente...</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

