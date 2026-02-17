'use client'

import type { Item } from '@/types/item';

export interface DocCardMeta {
  id: string
  fileId?: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  speakers?: string[]
  speakers_image_url?: string[]
  year?: number | string
  track?: string
  date?: string
  region?: string
  upsertedAt?: string
  slug?: string
  coverImageUrl?: string
  /** Thumbnail-URL für performante Galerie-Ansicht (320x320 WebP) */
  coverThumbnailUrl?: string
  pages?: number
  /** Item-Typ (document, event, joboffer, testimonial, etc.) */
  docType?: string
  /**
   * Detailansicht-Typ (Frontmatter: detailViewType).
   *
   * WICHTIG:
   * - Der Wizard/Frontmatter soll die UI-Detailansicht pro Dokument steuern.
   * - Fallback (wenn nicht gesetzt): Library-Konfiguration.
   */
  detailViewType?: string
  /** Optional: Parent-Item-ID für Hierarchien (z.B. testimonial.parentId = event.id) */
  parentId?: string
  
  // Klimamaßnahmen-spezifische Felder
  /** Maßnahmennummer (z.B. "456") */
  massnahme_nr?: string
  /** Arbeitsgruppe (z.B. "Energie", "Mobilität") */
  arbeitsgruppe?: string
  /** Bewertung der Landesverwaltung (z.B. "in_umsetzung", "nicht_umsetzbar") */
  lv_bewertung?: string
  /** Kategorie für Facettenfilter (z.B. Handlungsfeld bei Klimamaßnahmen) */
  category?: string

  // Session/Event-spezifische Felder für Gallery-Karten
  /** Organisation des Sprechers/Events (z.B. "Universität Innsbruck") */
  organisation?: string
  /** Tags für Facettenfilter und Detail-Anzeige */
  tags?: string[]
  /** Themen/Topics für Facettenfilter und Detail-Anzeige */
  topics?: string[]
}

export interface ChapterInfo {
  title: string
  summary?: string
  pageStart?: number
  pageEnd?: number
}

export interface DetailDoc extends DocCardMeta {
  chapters?: ChapterInfo[]
  pdfUrl?: string
}

export interface GalleryTexts {
  headline: string
  subtitle: string
  description: string
  filterDescription: string
}

export interface StatsTotals { docs: number; chunks: number }
export interface StatsResponse { ok?: boolean; indexExists?: boolean; totals?: StatsTotals }

/**
 * Mappt ein Item zu DocCardMeta für die Gallery-Anzeige.
 * 
 * Diese Funktion konvertiert das generische Item-Modell in das
 * Frontend-spezifische DocCardMeta-Format.
 * 
 * @param item Item aus MongoDB
 * @returns DocCardMeta für Gallery-Komponenten
 */
export function mapItemToDocCardMeta(item: Item): DocCardMeta {
  return {
    id: item.id,
    fileId: item.id,
    fileName: item.fileName,
    title: item.meta.title as string | undefined,
    shortTitle: item.meta.shortTitle as string | undefined,
    authors: item.authors,
    speakers: item.meta.speakers as string[] | undefined,
    speakers_image_url: item.meta.speakers_image_url as string[] | undefined,
    year: item.year,
    track: item.meta.track as string | undefined,
    date: item.meta.date as string | undefined,
    region: item.region,
    upsertedAt: item.upsertedAt,
    slug: item.meta.slug as string | undefined,
    coverImageUrl: item.meta.coverImageUrl as string | undefined,
    coverThumbnailUrl: item.meta.coverThumbnailUrl as string | undefined,
    pages: item.meta.pages as number | undefined,
    docType: item.docType,
    detailViewType: item.meta.detailViewType as string | undefined,
    parentId: item.parentId,
    // Klimamaßnahmen-spezifische Felder
    massnahme_nr: item.meta.massnahme_nr as string | undefined,
    arbeitsgruppe: item.meta.arbeitsgruppe as string | undefined,
    lv_bewertung: item.meta.lv_bewertung as string | undefined,
    // category mit Fallback auf handlungsfeld für ältere Daten in der DB
    category: (item.meta.category || item.meta.handlungsfeld) as string | undefined,
    // Session/Event-spezifische Felder
    organisation: item.meta.organisation as string | undefined,
    tags: Array.isArray(item.meta.tags) ? item.meta.tags as string[] : undefined,
    topics: Array.isArray(item.meta.topics) ? item.meta.topics as string[] : undefined,
  };
}












