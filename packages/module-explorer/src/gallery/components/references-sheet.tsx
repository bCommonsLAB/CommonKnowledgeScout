'use client'

/**
 * Quellen-Blatt der schmalen Ansicht (D4, D12m): unter `lg` gibt es keine
 * rechte Spalte, die Quellen kommen als Blatt von rechts. Seit D12m zeigt es
 * DIESELBEN Listen wie die Spalte am Desktop — `QuellenListe` fuer die
 * Themenuebersicht, `BelegListe` fuer eine Antwort — statt des alten
 * Galerie-Rasters mit Bildern, Ansichts-Umschaltern und Dichte (Owner
 * 04.10.: „im Source-Code doppelt"). Das X der Listen schliesst das Blatt;
 * der Weg in den Katalog schliesst es und bittet die Mitte um die Uebersicht.
 */

import type { ReactNode } from 'react'
import type { DocReference } from '@ks/contracts'
import { Sheet, SheetContent, SheetTitle } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { DocCardMeta } from '../lib/types'
import { BelegListe } from './beleg-liste/beleg-liste'
import { QuellenListe } from './beleg-liste/quellen-liste'

export interface ReferencesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  /** `answer`: Belege der gezeigten Antwort; `toc`: der gefilterte Bestand der Uebersicht. */
  mode: 'answer' | 'toc'
  libraryDetailViewType?: string
  onOpenDocument?: (doc: DocCardMeta) => void
  /** Antwort-Modus */
  references?: DocReference[]
  usedDocs?: DocCardMeta[]
  unusedDocs?: DocCardMeta[]
  /** In den Katalog (Mitte zur Uebersicht); das Blatt schliesst dabei. */
  onKatalog?: () => void
  /** Uebersichts-Modus */
  docs?: DocCardMeta[]
  anzahl?: number
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  filterAnzeige?: ReactNode
  loading?: boolean
  error?: string | null
}

export function ReferencesSheet({
  open,
  onOpenChange,
  libraryId,
  mode,
  libraryDetailViewType,
  onOpenDocument,
  references = [],
  usedDocs = [],
  unusedDocs = [],
  onKatalog,
  docs = [],
  anzahl = 0,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  filterAnzeige,
  loading = false,
  error = null,
}: ReferencesSheetProps) {
  const { t } = useTranslation()
  const schliessen = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl" hideCloseButton={true}>
        <SheetTitle className="sr-only">{mode === 'toc' ? t('gallery.tocReferences') : t('gallery.references')}</SheetTitle>
        {mode === 'answer' ? (
          <BelegListe
            references={references}
            usedDocs={usedDocs}
            unusedDocs={unusedDocs}
            libraryId={libraryId}
            libraryDetailViewType={libraryDetailViewType}
            katalogAnzahl={anzahl}
            onOpenDocument={onOpenDocument}
            onZuklappen={schliessen}
            onKatalog={() => {
              schliessen()
              onKatalog?.()
            }}
          />
        ) : (
          <QuellenListe
            docs={docs}
            anzahl={anzahl}
            loading={loading}
            error={error}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore ?? (() => undefined)}
            libraryId={libraryId}
            libraryDetailViewType={libraryDetailViewType}
            filterAnzeige={filterAnzeige}
            onOpenDocument={onOpenDocument}
            onZuklappen={schliessen}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
