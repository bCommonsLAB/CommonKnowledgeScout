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
// Badge Import entfernt - wurde nicht verwendet
import { useTranslation } from '@/lib/i18n/hooks'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'
import type { ViewMode } from './gallery-sticky-header'
import { ItemsGrid } from './items-grid'
import { DeleteDocumentButton } from './delete-document-button'
import { OpenInArchiveButton } from './open-in-archive-button'
import { useIsLibraryOwner } from '@/hooks/gallery/use-is-library-owner'
import { formatUpsertedAt } from '@/utils/format-upserted-at'
import { getTableColumnsForViewType } from '@/lib/detail-view-types'

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
  /** Gruppierungsfeld: 'year', 'none', oder ein Facetten-Key (z.B. 'category') */
  groupByField?: string
  /** Facetten mit showInTable=true – definieren die Tabellenspalten (Reihenfolge wie in Config) */
  tableColumnFacets?: Array<{ metaKey: string; label?: string }>
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
  groupByField,
  tableColumnFacets,
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

  // Tabellenspalten: aus Facetten (showInTable) oder aus DetailViewType
  const tableColumns = React.useMemo(() => {
    if (tableColumnFacets && tableColumnFacets.length > 0) {
      return [
        { key: 'title', labelKey: 'gallery.table.title' as const },
        ...tableColumnFacets.map((f) => ({ key: f.metaKey, label: f.label || f.metaKey })),
        { key: 'upsertedAt', labelKey: 'gallery.table.upsertedAt' as const },
      ]
    }
    return getTableColumnsForViewType(libraryDetailViewType).map((col) => ({
      key: col.key,
      labelKey: col.labelKey,
    }))
  }, [libraryDetailViewType, tableColumnFacets])

  // Zellwert für eine Spalte aus doc lesen (inkl. title, upsertedAt, Arrays)
  const getCellValue = (doc: DocCardMeta, key: string): React.ReactNode => {
    if (key === 'title') {
      return (
        <div className="flex flex-col gap-1">
          <span className="line-clamp-2">
            {doc.shortTitle || doc.title || doc.fileName || 'Dokument'}
          </span>
          {(doc.speakers?.length ?? doc.authors?.length) ? (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {formatSpeakers(doc)}
            </span>
          ) : null}
        </div>
      )
    }
    if (key === 'upsertedAt') {
      return (
        <span className="whitespace-nowrap text-sm text-muted-foreground" title={doc.upsertedAt ?? ''}>
          {formatUpsertedAt(doc.upsertedAt, { locale })}
        </span>
      )
    }
    const raw = (doc as unknown as Record<string, unknown>)[key]
    if (raw === undefined || raw === null) return <span className="text-muted-foreground">-</span>
    if (Array.isArray(raw)) {
      const str = raw.length === 1 ? String(raw[0]) : `${raw[0]} +${raw.length - 1}`
      return <span className="line-clamp-1">{str}</span>
    }
    const str = String(raw)
    if (str.length > 40) return <span className="line-clamp-2" title={str}>{str}</span>
    return <span>{str}</span>
  }

  // Grid-Modus: Einfaches Infinite Scroll ohne vollständige Virtualisierung (wegen unterschiedlicher Card-Höhen)
  if (viewMode === 'grid') {
    return (
      <div ref={parentRef}>
        <ItemsGrid docsByYear={docsByYear} onOpen={onOpen} libraryId={libraryId} libraryDetailViewType={libraryDetailViewType} groupByField={groupByField} />
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

  // Table-Modus: Dynamische Gruppierung (groupByField wie Galerie), Spalten aus DetailViewType, Thumbnail
  const showGroupHeaders = groupByField !== 'none'
  return (
    <div ref={parentRef}>
      {docsByYear.map(([groupKey, groupDocs]) => (
        <div key={String(groupKey)} className="mb-6">
          {showGroupHeaders && (
            <h3 className="text-lg font-semibold mb-2">
              {groupByField === 'year'
                ? (groupKey === 'Ohne Jahrgang' ? t('gallery.noYear') : t('gallery.year', { year: groupKey }))
                : (groupKey === 'Ohne Zuordnung' ? t('gallery.noGroup') : String(groupKey))}
            </h3>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 shrink-0" aria-label="Thumbnail" />
                  {tableColumns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={col.key === 'title' ? 'min-w-[120px]' : 'whitespace-nowrap'}
                    >
                      {'labelKey' in col && col.labelKey ? t(col.labelKey) : ('label' in col && col.label ? col.label : col.key)}
                    </TableHead>
                  ))}
                  {isOwner && <TableHead className="w-[60px] shrink-0" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupDocs.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(doc)}
                  >
                    <TableCell className="w-12 shrink-0 p-2 align-middle">
                      {(doc.coverThumbnailUrl || doc.coverImageUrl) ? (
                        <img
                          src={doc.coverThumbnailUrl || doc.coverImageUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted shrink-0" />
                      )}
                    </TableCell>
                    {tableColumns.map((col) => (
                      <TableCell key={col.key} className={col.key === 'title' ? 'font-medium' : ''}>
                        {getCellValue(doc, col.key)}
                      </TableCell>
                    ))}
                    {isOwner && libraryId && (
                      <TableCell className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <OpenInArchiveButton doc={doc} libraryId={libraryId} />
                          <DeleteDocumentButton
                            doc={doc}
                            libraryId={libraryId}
                            onDeleted={onDocumentDeleted}
                          />
                        </div>
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

