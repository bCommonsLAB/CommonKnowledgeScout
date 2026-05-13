'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n/hooks'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { openDocumentBySlug } from '@/utils/document-navigation'
import { getEffectiveDocumentNavigationSlug } from '@/utils/document-slug'
import { DeleteDocumentButton } from './delete-document-button'
import { PublishDocumentButton } from './publish-document-button'
import { PublishStatusBadge, TranslationStatusChips } from './publish-status-chips'
import { useIsLibraryOwner } from '@/hooks/gallery/use-is-library-owner'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useUserStates } from '@/hooks/gallery/use-user-states'
import { findDocInGroupedDocs } from '@/lib/gallery/apply-favorite-optimistic'
import { useSourceCommentCounts } from '@/hooks/gallery/use-source-comment-counts'
import { SourceStarsCell } from './source-stars-cell'
import { SourceCommentToggleButton } from './source-comment-toggle-button'
import { SourceCommentsPanel } from './source-comments-panel'
import { formatUpsertedAt } from '@/utils/format-upserted-at'

export interface ItemsTableProps {
  docsByYear: Array<[number | string, DocCardMeta[]]>
  onOpen?: (doc: DocCardMeta) => void
  libraryId?: string
  /** Callback nach erfolgreichem Löschen eines Dokuments */
  onDocumentDeleted?: () => void
  /**
   * Erwartete Ziel-Locales aus `library.config.translations.targetLocales`.
   * Wird fuer die Status-Chips genutzt, damit auch noch nicht enqueued Locales
   * sichtbar sind (Spaltenbreite bleibt konsistent).
   */
  expectedTargetLocales?: string[]
  /** Callback nach Publish/Unpublish/Re-translate (zum Reload der Galerie) */
  onPublishChanged?: () => void
  /**
   * Stern-Toggle mit optimistischem Galerie-Cache, von `gallery-root`
   * durchgereicht.
   */
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}

/**
 * Tabellenansicht der Gallery-Dokumente
 * Zeigt Dokumente kompakt in einer Tabelle mit den wichtigsten Feldern
 */
export function ItemsTable({
  docsByYear,
  onOpen,
  libraryId,
  onDocumentDeleted,
  expectedTargetLocales,
  onPublishChanged,
  onToggleFavorite,
}: ItemsTableProps) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isOwner } = useIsLibraryOwner(libraryId)
  const { isSignedIn, isMember } = useLibraryRole(libraryId)
  const visibleFileIds = React.useMemo(
    () =>
      docsByYear.flatMap(([, docs]) =>
        docs.map((d) => d.fileId).filter((id): id is string => Boolean(id)),
      ),
    [docsByYear],
  )
  const { setState: setUserState } = useUserStates(libraryId, visibleFileIds)
  const { counts: commentCounts } = useSourceCommentCounts(libraryId, visibleFileIds)
  const handleToggleFavorite = React.useCallback(
    async (fileId: string) => {
      if (onToggleFavorite) {
        await onToggleFavorite(fileId)
        return
      }
      const row = findDocInGroupedDocs(docsByYear, fileId)
      const next = !(row?.isFavorite === true)
      await setUserState(fileId, next ? 'favorite' : null)
    },
    [onToggleFavorite, docsByYear, setUserState],
  )
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(() => new Set())
  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleRowClick = (doc: DocCardMeta) => {
    const slug = getEffectiveDocumentNavigationSlug(doc)
    if (slug && libraryId) {
      openDocumentBySlug(slug, libraryId, router, pathname, searchParams)
    } else if (onOpen) {
      onOpen(doc)
    }
  }

  // Formatiere Speaker für kompakte Anzeige
  const formatSpeakers = (doc: DocCardMeta): string => {
    if (Array.isArray(doc.speakers) && doc.speakers.length > 0) {
      return doc.speakers.length === 1
        ? doc.speakers[0]
        : `${doc.speakers[0]} +${doc.speakers.length - 1}`
    }
    // Fallback auf Autoren, wenn keine Speaker vorhanden
    if (Array.isArray(doc.authors) && doc.authors.length > 0) {
      return doc.authors.length === 1
        ? doc.authors[0]
        : `${doc.authors[0]} +${doc.authors.length - 1}`
    }
    return '-'
  }

  return (
    <div>
      {docsByYear.map(([year, yearDocs]) => (
        <div key={year}>
          <h3 className="text-lg font-semibold">
            {year === 'Ohne Jahrgang' ? t('gallery.noYear') : t('gallery.year', { year })}
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isSignedIn && (
                    <TableHead className="w-10 shrink-0" aria-label="Kommentare" />
                  )}
                  {isMember && (
                    <TableHead className="w-[88px] shrink-0" aria-label="Sterne" />
                  )}
                  <TableHead className="w-[35%]">{t('gallery.table.title')}</TableHead>
                  <TableHead className="w-[10%]">{t('gallery.table.year')}</TableHead>
                  <TableHead className="w-[10%]">{t('gallery.table.track')}</TableHead>
                  {/* Doc-Translations Refactor: Publikations- und Sprachen-Spalten */}
                  {isOwner && (
                    <TableHead className="w-[10%] whitespace-nowrap">
                      {t('gallery.table.publication', { defaultValue: 'Status' })}
                    </TableHead>
                  )}
                  {isOwner && (
                    <TableHead className="w-[15%] whitespace-nowrap">
                      {t('gallery.table.languages', { defaultValue: 'Sprachen' })}
                    </TableHead>
                  )}
                  <TableHead className="w-[15%] whitespace-nowrap">{t('gallery.table.upsertedAt')}</TableHead>
                  {isOwner && <TableHead className="w-[120px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearDocs.map((doc) => {
                  const docFileId = doc.fileId
                  const isExpanded = Boolean(docFileId && expandedRows.has(docFileId))
                  const leadingExtraCols = (isSignedIn ? 1 : 0) + (isMember ? 1 : 0)
                  const baseCols = 5 // Title + Year + Track + Upserted + Padding-Spalte
                  const ownerExtraCols = isOwner ? 3 : 0 // Status, Sprachen, Aktionen
                  const expandedColSpan = leadingExtraCols + baseCols + ownerExtraCols
                  return (
                  <React.Fragment key={doc.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(doc)}
                  >
                    {isSignedIn && (
                      <TableCell className="w-10 shrink-0 p-1 align-middle" onClick={(e) => e.stopPropagation()}>
                        {docFileId && libraryId ? (
                          <SourceCommentToggleButton
                            open={isExpanded}
                            count={commentCounts[docFileId]}
                            onToggle={() => toggleExpanded(docFileId)}
                          />
                        ) : null}
                      </TableCell>
                    )}
                    {isMember && (
                      <TableCell className="w-[88px] shrink-0 p-1 align-middle" onClick={(e) => e.stopPropagation()}>
                        {docFileId && libraryId ? (
                          <SourceStarsCell
                            libraryId={libraryId}
                            fileId={docFileId}
                            isFavorite={doc.isFavorite === true}
                            count={doc.favoriteCount ?? 0}
                            voters={doc.favoriteVoters ?? []}
                            onToggleFavorite={handleToggleFavorite}
                          />
                        ) : null}
                      </TableCell>
                    )}
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
                          {/* Doc-Translations: zeige uebersetztes Label, kanonischer Wert bleibt im Filter. */}
                          {doc.trackLabel || doc.track}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* Doc-Translations Refactor: Status- und Sprachen-Spalten nur fuer Owner */}
                    {isOwner && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <PublishStatusBadge status={doc.publicationStatus} />
                      </TableCell>
                    )}
                    {isOwner && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TranslationStatusChips
                          status={doc.translationStatus}
                          expectedLocales={expectedTargetLocales}
                        />
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      <span title={doc.upsertedAt ?? ''}>
                        {formatUpsertedAt(doc.upsertedAt, { locale })}
                      </span>
                    </TableCell>
                    {isOwner && libraryId && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className='flex items-center gap-1'>
                          {/* Doc-Translations Refactor: Publish/Unpublish/Re-translate Aktion */}
                          <PublishDocumentButton
                            doc={doc}
                            libraryId={libraryId}
                            onChanged={onPublishChanged}
                          />
                          <DeleteDocumentButton
                            doc={doc}
                            libraryId={libraryId}
                            onDeleted={onDocumentDeleted}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  {isExpanded && docFileId && libraryId ? (
                    <TableRow className="bg-muted/10" onClick={(e) => e.stopPropagation()}>
                      <TableCell colSpan={expandedColSpan} className="px-4 py-3 align-top">
                        <SourceCommentsPanel
                          libraryId={libraryId}
                          fileId={docFileId}
                          open
                        />
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
    </div>
  )
}

