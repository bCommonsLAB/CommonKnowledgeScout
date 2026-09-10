'use client'

/**
 * @fileoverview Der Buch-Renderer der eingebetteten Galerie (M5).
 *
 * @description
 * Die Voll-App reicht der Galerie ihre eigene Renderer-Tabelle herein
 * (`src/components/library/gallery-detail-renderers.tsx`, dort mit
 * `IngestionBookDetail`, das bei Bedarf selbst nachlaedt). Im Embed gibt es
 * keine App: Hier baut das Paket die Ansicht aus dem, was die Detailansicht
 * der Galerie ohnehin geladen hat (`docMeta`, schon sprach-veredelt) — kein
 * zweiter Request.
 *
 * Bilder kommen vom Gastgeber (`Bild`), Markdown aus `MarkdownBody`, und der
 * KI-Hinweis verlinkt auf die rechtlichen Hinweise der Instanz, nicht auf eine
 * Route der fremden Seite.
 *
 * @module components/book-detail
 */

import { useMemo } from 'react'
import { useTranslation } from '@ks/i18n/react'
import { mapToBookDetail } from '../../../doc-meta/book-detail-mapper'
import { useGalleryHost } from '../../contexts/gallery-host-context'
import type { DetailRenderer } from '../detail-overlay'
import { AIGeneratedNotice, type HinweisLinkProps } from './ai-generated-notice'
import { BookDetail } from './book-detail'
import { MarkdownBody } from './markdown-body'

/** Die rechtlichen Hinweise der Instanz (App-Route `/info`). */
const HINWEIS_PFAD = '/info?type=rechtliche-hinweise'

/** In einer fremden Seite oeffnet der Hinweis die Instanz in einem neuen Tab. */
function InstanzLink({ href, className, children }: HinweisLinkProps) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export const BuchDetailRenderer: DetailRenderer = ({ docMeta, isDocMetaReady }) => {
  const { t } = useTranslation()
  const { Bild, instanz } = useGalleryHost()
  const data = useMemo(() => (docMeta ? mapToBookDetail(docMeta) : null), [docMeta])

  if (!isDocMetaReady) {
    return <div className="text-sm text-muted-foreground">{t('gallery.loading')}</div>
  }
  if (!data) {
    // Die Detailansicht hat nichts geliefert (unbekannt, Entwurf, Fehler) — sagen, nicht leer bleiben.
    return (
      <div className="text-sm text-muted-foreground">
        {t('gallery.documentNotFound', { defaultValue: 'Dokument nicht gefunden.' })}
      </div>
    )
  }

  return (
    <BookDetail
      data={data}
      Bild={Bild}
      Markdown={MarkdownBody}
      kiHinweis={<AIGeneratedNotice compact hinweisHref={instanz.url(HINWEIS_PFAD)} Link={InstanzLink} />}
      backLink={null}
    />
  )
}
