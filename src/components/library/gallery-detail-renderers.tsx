'use client'

/**
 * @fileoverview Welche Detailansicht zu welchem Renderer-Typ gehoert — die Tabelle der Voll-App.
 *
 * @description
 * Bis Welle M4g stand diese Tabelle in `gallery/detail-overlay.tsx` und zog
 * damit zehn App-Komponenten (1.700 Zeilen, dahinter ~5.300) in den
 * Galerie-Kegel. Die Galerie braucht davon nichts zu kennen: Sie laedt die
 * Doc-Meta, lokalisiert sie und reicht sie dem Renderer — welcher das ist,
 * sagt ihr der Montagepunkt (`src/app/library/gallery/client.tsx`).
 *
 * `Record<DetailViewType, …>` ist weiterhin der eigentliche Punkt: Wer in
 * `@ks/contracts` einen neuen `detailViewType` ergaenzt, bekommt HIER einen
 * Typfehler, bis er eine Ansicht zuordnet (no-silent-fallbacks). Die Grenze
 * ist nur umgezogen, nicht aufgeweicht.
 *
 * `testimonial` und `blog` zeigen bewusst die Buch-Ansicht. Fuer `testimonial`
 * existiert mit `testimonial-detail.tsx` zwar eine eigene Komponente, sie war
 * aber nie angeschlossen; sie jetzt zu verdrahten waere eine
 * Verhaltensaenderung und braucht eine Entscheidung, keine Refactoring-Welle.
 *
 * Die Renderer sind Komponenten, keine Funktionen: `IngestionBookDetail` und
 * `IngestionSessionDetail` haengen `initialData` in einen Effekt — ein bei
 * jedem Render neu gemapptes Objekt wuerde den Effekt endlos feuern. Deshalb
 * `useMemo` ueber der Doc-Meta.
 *
 * @module components/library
 */

import * as React from 'react'
import type { DetailViewType } from '@ks/contracts'
import type { DetailRenderer, DetailRenderProps } from '@/components/library/gallery/detail-overlay'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { IngestionClimateActionDetail } from '@/components/library/ingestion-climate-action-detail'
import { IngestionDivaDocumentDetail } from '@/components/library/ingestion-diva-document-detail'
import { IngestionDivaTextureDetail } from '@/components/library/ingestion-diva-texture-detail'
import { IngestionRefurbedDeviceDetail } from '@/components/library/ingestion-refurbed-device-detail'
import { IngestionWebsiteDetail } from '@/components/library/ingestion-website-detail'
import { mapToBookDetail, mapToSessionDetail } from '@/lib/mappers/doc-meta-mappers'

/**
 * Mapping einmal pro Doc-Meta, nicht pro Render. Ein Mapper-Fehler heisst
 * „keine Vorab-Daten" — die Detailansicht laedt dann selbst, wie bisher.
 */
function useVorabDaten<T>(docMeta: DetailRenderProps['docMeta'], map: (input: unknown) => T): T | undefined {
  return React.useMemo(() => {
    if (!docMeta) return undefined
    try {
      return map(docMeta)
    } catch {
      return undefined
    }
  }, [docMeta, map])
}

const BuchRenderer: DetailRenderer = ({ libraryId, fileId, docMeta, isDocMetaReady, fallbackLocale }) => {
  const initialData = useVorabDaten(docMeta, mapToBookDetail)
  return (
    <IngestionBookDetail
      libraryId={libraryId}
      fileId={fileId}
      initialData={initialData}
      suspendInitialFetch={!isDocMetaReady}
      fallbackLocale={fallbackLocale}
    />
  )
}

const SessionRenderer: DetailRenderer = ({ libraryId, fileId, docMeta, isDocMetaReady, fallbackLocale }) => {
  const initialData = useVorabDaten(docMeta, mapToSessionDetail)
  return (
    <IngestionSessionDetail
      libraryId={libraryId}
      fileId={fileId}
      initialData={initialData}
      suspendInitialFetch={!isDocMetaReady}
      fallbackLocale={fallbackLocale}
    />
  )
}

const KlimaRenderer: DetailRenderer = ({ libraryId, fileId, fallbackLocale }) => (
  <IngestionClimateActionDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
)

const DivaDokumentRenderer: DetailRenderer = ({ libraryId, fileId, fallbackLocale }) => (
  <IngestionDivaDocumentDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
)

const DivaTexturRenderer: DetailRenderer = ({ libraryId, fileId }) => (
  <IngestionDivaTextureDetail libraryId={libraryId} fileId={fileId} />
)

const RefurbedRenderer: DetailRenderer = ({ libraryId, fileId, fallbackLocale }) => (
  <IngestionRefurbedDeviceDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
)

const WebsiteRenderer: DetailRenderer = ({ libraryId, fileId, fallbackLocale }) => (
  <IngestionWebsiteDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
)

export const DETAIL_RENDERERS: Record<DetailViewType, DetailRenderer> = {
  book: BuchRenderer,
  testimonial: BuchRenderer,
  blog: BuchRenderer,
  session: SessionRenderer,
  climateAction: KlimaRenderer,
  divaDocument: DivaDokumentRenderer,
  divaTexture: DivaTexturRenderer,
  refurbedDevice: RefurbedRenderer,
  website: WebsiteRenderer,
}
