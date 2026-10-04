'use client'

/**
 * Rechte Spalte des Story-Modus, sobald eine Antwort aktiv ist (D3): die
 * Belege der Antwort als schmale Kartenliste statt Galerie-Raster. Darunter
 * die weiteren gefundenen Dokumente (zugeklappt) und der Weg in den Katalog.
 *
 * Ersetzt in der Spalte `GroupedItemsView`; das Mobil-Sheet behaelt die
 * gruppierte Ansicht (D4 ordnet Mobil neu).
 *
 * D12l: Die Quellen folgen der Mitte. Das X klappt die Spalte nur zu (die
 * Belege bleiben die der gezeigten Antwort); der Weg in den Katalog schickt
 * die Mitte zur Themenuebersicht, dann zeigt die Spalte den Katalog.
 */

import { useMemo } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, ScrollArea } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { useGalleryNavigation } from '../../contexts/gallery-navigation-context'
import { BelegKarte } from './beleg-karte'
import { belegeAusReferenzen, ersteSeite, type Beleg } from './helpers'

export interface BelegListeProps {
  references: DocReference[]
  /** Dokumente der Antwort aus dem Galerie-Bestand (fuer Kurztext, Plakette, Kennzeile). */
  usedDocs: DocCardMeta[]
  /** Gefunden, aber nicht zitiert. */
  unusedDocs: DocCardMeta[]
  libraryId: string
  libraryDetailViewType?: string
  /** Anzahl der Dokumente im (gefilterten) Katalog — fuer den Weg dorthin. */
  katalogAnzahl: number
  /** Dokument ohne Adresse oeffnen (Rueckfall der Galerie). */
  onOpenDocument?: (doc: DocCardMeta) => void
  /** Spalte zuklappen (D11b-Leiste); die Belege bleiben. */
  onZuklappen: () => void
  /** In den Katalog: die Mitte geht zur Themenuebersicht, die Quellen folgen. */
  onKatalog: () => void
}

export function BelegListe({
  references,
  usedDocs,
  unusedDocs,
  libraryId,
  libraryDetailViewType,
  katalogAnzahl,
  onOpenDocument,
  onZuklappen,
  onKatalog,
}: BelegListeProps) {
  const { t } = useTranslation()
  const { openDocument } = useGalleryNavigation()
  const belege = useMemo(() => belegeAusReferenzen(references, usedDocs, libraryDetailViewType), [references, usedDocs, libraryDetailViewType])

  function oeffnen(doc: DocCardMeta | undefined, fileId: string, fileName?: string, page?: number) {
    const slug = doc ? getEffectiveDocumentNavigationSlug(doc) : undefined
    // D7: Nur die Adressierung kennt die Seite; die Rueckfaelle oeffnen am Anfang.
    if (slug && page !== undefined) openDocument(slug, { page })
    else if (slug) openDocument(slug)
    else if (doc && onOpenDocument) onOpenDocument(doc)
    else window.dispatchEvent(new CustomEvent('open-document-detail', { detail: { fileId, fileName, libraryId } }))
  }

  const original = (beleg: Beleg, page?: number) =>
    oeffnen(beleg.doc, beleg.fileId, beleg.doc?.fileName ?? beleg.titel, page ?? ersteSeite(beleg))
  const anzahlText = belege.length === 1 ? t('story.beleg.count.one') : t('story.beleg.count.many', { count: belege.length })

  return (
    <div className="flex h-full min-h-0 flex-col" data-beleg-liste>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t('story.beleg.title')}</h2>
          <p className="text-xs text-muted-foreground">{anzahlText}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onZuklappen} aria-label={t('story.beleg.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {belege.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('story.beleg.none')}</p>
          ) : (
            <ul className="space-y-2">
              {belege.map((beleg) => (
                <BelegKarte key={beleg.fileId} beleg={beleg} onOriginal={original} />
              ))}
            </ul>
          )}

          {unusedDocs.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="weitere" className="border-b-0">
                <AccordionTrigger className="py-2 text-xs font-medium text-muted-foreground">
                  {t('story.beleg.moreFound', { count: unusedDocs.length })}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-0.5">
                    {unusedDocs.map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          onClick={() => oeffnen(doc, doc.fileId ?? doc.id, doc.fileName)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                        >
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{doc.title ?? doc.shortTitle ?? doc.fileName ?? doc.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onKatalog}>
          {t('story.beleg.catalog', { count: katalogAnzahl })}
        </Button>
      </div>
    </div>
  )
}
