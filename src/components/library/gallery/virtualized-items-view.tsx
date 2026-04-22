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
import { getEffectiveDocumentNavigationSlug } from '@/utils/document-slug'
import type { ViewMode } from './gallery-sticky-header'
import { ItemsGrid } from './items-grid'
import { DeleteDocumentButton } from './delete-document-button'
import { OpenInArchiveButton } from './open-in-archive-button'
import { PublishDocumentButton } from './publish-document-button'
import { PublishStatusBadge, TranslationStatusChips } from './publish-status-chips'
import { useIsLibraryOwner } from '@/hooks/gallery/use-is-library-owner'
import { formatUpsertedAt } from '@/utils/format-upserted-at'
import { getTableColumnsForViewType } from '@/lib/detail-view-types'
import { sortDocsByTableColumn } from '@/lib/gallery/table-sort'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { buildGalleryDocSourcePathLine, buildGalleryDocSourcePathParts } from '@/lib/gallery/doc-source-path'
import type { GalleryCardDensity } from '@/lib/gallery/gallery-card-density'

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
  cardDensity?: GalleryCardDensity
  /**
   * Doc-Translations Refactor:
   * Erwartete Ziel-Locales aus `library.config.translations.targetLocales`.
   * Wird in der Spalte „Sprachen" angezeigt, damit auch noch nicht enqueued
   * Locales als Chip sichtbar sind (Spaltenbreite bleibt konsistent).
   */
  expectedTargetLocales?: string[]
  /**
   * Doc-Translations Refactor:
   * Callback nach erfolgreichem Publish/Unpublish/Re-translate.
   * Wird verwendet, um die Galerie nach einer Aktion neu zu laden.
   */
  onPublishChanged?: () => void
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
  cardDensity = 'comfortable',
  expectedTargetLocales,
  onPublishChanged,
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

  /** Tabellen-Sortierung: nur innerhalb jeder Gruppe (z. B. Jahr), nicht global über Gruppen hinweg */
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')

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
    const slug = getEffectiveDocumentNavigationSlug(doc)
    if (slug && libraryId) {
      openDocumentBySlug(slug, libraryId, router, pathname, searchParams)
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

  // Tabellenspalten: aus Facetten (showInTable) oder aus DetailViewType.
  // Doc-Translations Refactor: fuer Owner injizieren wir vor der upsertedAt-Spalte
  // zwei zusaetzliche Spalten: 'publication' (Status-Badge) und 'languages' (Locale-Chips).
  const tableColumns = React.useMemo(() => {
    const baseColumns = (() => {
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
    })()
    if (!isOwner) return baseColumns
    // Vor der letzten Spalte (typischerweise upsertedAt) die zwei neuen Spalten einfuegen.
    const insertAt = Math.max(0, baseColumns.length - 1)
    const ownerColumns = [
      { key: 'publication', label: 'Status' },
      { key: 'languages', label: 'Sprachen' },
    ]
    return [
      ...baseColumns.slice(0, insertAt),
      ...ownerColumns,
      ...baseColumns.slice(insertAt),
    ]
  }, [libraryDetailViewType, tableColumnFacets, isOwner])

  const displayDocsByYear = React.useMemo(() => {
    if (viewMode !== 'table' || !sortColumn) return docsByYear
    return docsByYear.map(
      ([groupKey, groupDocs]) =>
        [groupKey, sortDocsByTableColumn(groupDocs, sortColumn, sortDir)] as [number | string, DocCardMeta[]]
    )
  }, [docsByYear, viewMode, sortColumn, sortDir])

  const columnHeaderLabel = React.useCallback(
    (col: { key: string; labelKey?: string; label?: string }) => {
      if (col.labelKey) return t(col.labelKey)
      if (col.label) return col.label
      return col.key
    },
    [t]
  )

  const onHeaderSort = React.useCallback((key: string) => {
    setSortColumn((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
  }, [])

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
    // Doc-Translations Refactor: Publikationsstatus als Badge.
    if (key === 'publication') {
      return <PublishStatusBadge status={doc.publicationStatus} />
    }
    // Doc-Translations Refactor: Translation-Status pro Locale als kleine Chips.
    if (key === 'languages') {
      return (
        <TranslationStatusChips
          status={doc.translationStatus}
          expectedLocales={expectedTargetLocales}
        />
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
        <ItemsGrid
          docsByYear={docsByYear}
          onOpen={onOpen}
          libraryId={libraryId}
          libraryDetailViewType={libraryDetailViewType}
          groupByField={groupByField}
          cardDensity={cardDensity}
        />
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
      {displayDocsByYear.map(([groupKey, groupDocs]) => (
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
                  {tableColumns.map((col) => {
                    const label = columnHeaderLabel(col)
                    const isSorted = sortColumn === col.key
                    return (
                      <TableHead
                        key={col.key}
                        className={col.key === 'title' ? 'min-w-[120px]' : 'whitespace-nowrap'}
                        aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 max-w-full text-left font-medium hover:text-foreground text-muted-foreground hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            onHeaderSort(col.key)
                          }}
                          title={
                            isSorted
                              ? sortDir === 'asc'
                                ? t('gallery.table.sortAscending', { label })
                                : t('gallery.table.sortDescending', { label })
                              : t('gallery.table.sortByColumn', { label })
                          }
                          aria-label={
                            isSorted
                              ? sortDir === 'asc'
                                ? t('gallery.table.sortAscending', { label })
                                : t('gallery.table.sortDescending', { label })
                              : t('gallery.table.sortByColumn', { label })
                          }
                        >
                          <span className="truncate">{label}</span>
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
                            ) : (
                              <ArrowDown className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
                            )
                          ) : (
                            // Gut sichtbar neben dem Label (vorher opacity-40 — in Screenshots oft „unsichtbar“)
                            <ArrowUpDown className="h-4 w-4 shrink-0 text-foreground/55" aria-hidden />
                          )}
                        </button>
                      </TableHead>
                    )
                  })}
                  {isOwner && <TableHead className="w-[140px] shrink-0" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupDocs.map((doc) => {
                  const sourcePathParts = isOwner && libraryId ? buildGalleryDocSourcePathParts(doc) : null
                  const sourcePathTitle =
                    isOwner && libraryId ? buildGalleryDocSourcePathLine(doc) : null
                  const hasSourcePathRow =
                    Boolean(sourcePathParts && (sourcePathParts.directory || sourcePathParts.fileName))
                  const pathRowColSpan = 1 + tableColumns.length + (isOwner && libraryId ? 1 : 0)
                  return (
                    <React.Fragment key={doc.id}>
                      <TableRow
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
                              {/* Doc-Translations Refactor: Publish/Unpublish/Re-translate Aktion */}
                              <PublishDocumentButton
                                doc={doc}
                                libraryId={libraryId}
                                onChanged={onPublishChanged}
                              />
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
                      {/* Owner: volle Breite — Zeile 1 Ordner, Zeile 2 Datei(en), umbrechend statt einer Mini-Zeile */}
                      {isOwner && libraryId && hasSourcePathRow && sourcePathParts ? (
                        <TableRow
                          className="hover:bg-muted/30 bg-muted/15 border-t border-border/60"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TableCell colSpan={pathRowColSpan} className="py-1.5 px-3 align-top">
                            <div
                              className="space-y-0.5 text-[11px] leading-snug text-muted-foreground font-mono"
                              title={sourcePathTitle ?? undefined}
                            >
                              {sourcePathParts.directory ? (
                                <div className="break-all">{sourcePathParts.directory}</div>
                              ) : null}
                              {sourcePathParts.fileName ? (
                                <div className="break-all text-foreground/80">{sourcePathParts.fileName}</div>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  )
                })}
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

