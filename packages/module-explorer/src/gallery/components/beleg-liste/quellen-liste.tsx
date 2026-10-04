'use client'

/**
 * Rechte Spalte des Story-Modus OHNE aktive Antwort (D12q): der gefilterte
 * Bestand als kompakte Kartenliste (`QuellenKarte`: Titel, Kennzeile, Knopf
 * zur Detailansicht — eine Zeile) statt des Galerie-Rasters mit Bildern und
 * Ansichts-Umschaltern. Oben Zaehler, Zuklappen und die
 * Filter-Chips; unten laedt ein Fuehler weitere Dokumente nach (Fallback ein
 * Knopf, falls der Beobachter nicht feuert, z. B. in verborgenen Tabs).
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button, ScrollArea } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { DocCardMeta } from '@ks/contracts'
import { QuellenKarte } from './quellen-karte'
import { belegAusDokument, type Beleg } from './helpers'
import { useDokumentOeffnen } from './oeffnen'

export interface QuellenListeProps {
  docs: DocCardMeta[]
  /** Dokumente im (gefilterten) Bestand — der Zaehler. */
  anzahl: number
  loading: boolean
  error: string | null
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  libraryId: string
  libraryDetailViewType?: string
  /** Gesetzte Filter als Chips (D12o), unter dem Kopf. */
  filterAnzeige?: ReactNode
  onOpenDocument?: (doc: DocCardMeta) => void
  /** Spalte zuklappen (D11b-Leiste). */
  onZuklappen: () => void
}

export function QuellenListe({
  docs,
  anzahl,
  loading,
  error,
  hasMore,
  isLoadingMore,
  onLoadMore,
  libraryId,
  libraryDetailViewType,
  filterAnzeige,
  onOpenDocument,
  onZuklappen,
}: QuellenListeProps) {
  const { t } = useTranslation()
  const oeffnen = useDokumentOeffnen(libraryId, onOpenDocument)
  const belege = useMemo(() => docs.map((doc) => belegAusDokument(doc, libraryDetailViewType)), [docs, libraryDetailViewType])
  const detail = (beleg: Beleg) => oeffnen(beleg.doc, beleg.fileId, beleg.doc?.fileName ?? beleg.titel)

  // Nachladen, sobald der Fuehler sichtbar wird (wie das Galerie-Raster).
  const fuehler = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ziel = fuehler.current
    if (!ziel || !hasMore || isLoadingMore || typeof IntersectionObserver === 'undefined') return
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (eintraege[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '300px' },
    )
    beobachter.observe(ziel)
    return () => beobachter.disconnect()
  }, [hasMore, isLoadingMore, onLoadMore, docs.length])

  const anzahlText = `${anzahl} ${anzahl === 1 ? t('gallery.source') : t('gallery.sources')}`

  return (
    <div className="flex h-full min-h-0 flex-col" data-quellen-liste>
      <div className="shrink-0 space-y-2 border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('gallery.tocReferences')}</h2>
            <p className="text-xs text-muted-foreground">{anzahlText}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onZuklappen} aria-label={t('story.beleg.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {filterAnzeige}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">{t('gallery.loading')}</p>
          ) : belege.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('story.quellen.none')}</p>
          ) : (
            <ul className="space-y-2">
              {belege.map((beleg) => (
                <QuellenKarte key={beleg.fileId} beleg={beleg} onOeffnen={detail} />
              ))}
            </ul>
          )}
          {hasMore && (
            <div ref={fuehler} className="flex justify-center py-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onLoadMore} disabled={isLoadingMore}>
                {t('story.quellen.more')}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
