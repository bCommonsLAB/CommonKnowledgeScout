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
import { DeleteDocumentButton } from './delete-document-button'
import { useIsLibraryOwner } from '@/hooks/gallery/use-is-library-owner'

export interface ItemsTableProps {
  docsByYear: Array<[number | string, DocCardMeta[]]>
  onOpen?: (doc: DocCardMeta) => void
  libraryId?: string
  /** Callback nach erfolgreichem Löschen eines Dokuments */
  onDocumentDeleted?: () => void
}

/**
 * Tabellenansicht der Gallery-Dokumente
 * Zeigt Dokumente kompakt in einer Tabelle mit den wichtigsten Feldern
 */
export function ItemsTable({ docsByYear, onOpen, libraryId, onDocumentDeleted }: ItemsTableProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isOwner } = useIsLibraryOwner(libraryId)

  const handleRowClick = (doc: DocCardMeta) => {
    // Verwende zentrale Utility-Funktion wenn slug vorhanden ist
    if (doc.slug && libraryId) {
      openDocumentBySlug(doc.slug, libraryId, router, pathname, searchParams)
    } else if (onOpen) {
      // Fallback: Verwende onClick-Callback wenn kein slug vorhanden
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
                  <TableHead className="w-[60%]">{t('gallery.table.title')}</TableHead>
                  <TableHead className="w-[20%]">{t('gallery.table.year')}</TableHead>
                  <TableHead className="w-[20%]">{t('gallery.table.track')}</TableHead>
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
    </div>
  )
}

