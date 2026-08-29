'use client'

import type { Item } from '@/types/item';
import type { DocCardMeta } from '@ks/contracts';

/**
 * DocCardMeta, DetailDoc und ChapterInfo liegen seit Welle Galerie-Vertrag in
 * `@ks/contracts` — sie werden auch serverseitig gebraucht (vector-repo,
 * doc-meta-formatter, external-jobs), diese Datei traegt aber `'use client'`
 * (Galerie-Audit, Befund 1). Hier nur weitergereicht, damit die
 * UI-Importpfade unveraendert bleiben.
 */
export type { DocCardMeta, DetailDoc, ChapterInfo, FavoriteVoter } from '@ks/contracts';


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
    vorschlag_quelle: item.meta.vorschlag_quelle as string | undefined,
    lv_bewertung: item.meta.lv_bewertung as string | undefined,
    // category mit Fallback auf handlungsfeld für ältere Daten in der DB
    category: (item.meta.category || item.meta.handlungsfeld) as string | undefined,
    // Klimamaßnahmen-Bewertung (LLM-Schätzung)
    co2_einsparung_kt: typeof item.meta.co2_einsparung_kt === 'number' ? item.meta.co2_einsparung_kt : undefined,
    co2_einsparung_kt_begruendung: typeof item.meta.co2_einsparung_kt_begruendung === 'string' ? item.meta.co2_einsparung_kt_begruendung : undefined,
    durchsetzbarkeit: typeof item.meta.durchsetzbarkeit === 'number' ? item.meta.durchsetzbarkeit : undefined,
    durchsetzbarkeit_begruendung: typeof item.meta.durchsetzbarkeit_begruendung === 'string' ? item.meta.durchsetzbarkeit_begruendung : undefined,
    kosten_eur: typeof item.meta.kosten_eur === 'number' ? item.meta.kosten_eur : undefined,
    kosten_eur_begruendung: typeof item.meta.kosten_eur_begruendung === 'string' ? item.meta.kosten_eur_begruendung : undefined,
    score_wirkung: typeof item.meta.score_wirkung === 'number' ? item.meta.score_wirkung : undefined,
    score_soziales: typeof item.meta.score_soziales === 'number' ? item.meta.score_soziales : undefined,
    score_struktur: typeof item.meta.score_struktur === 'number' ? item.meta.score_struktur : undefined,
    score_bewusstsein: typeof item.meta.score_bewusstsein === 'number' ? item.meta.score_bewusstsein : undefined,
    perspektiven_begruendung: typeof item.meta.perspektiven_begruendung === 'string' ? item.meta.perspektiven_begruendung : undefined,
    dominant_perspektive: typeof item.meta.dominant_perspektive === 'string' ? item.meta.dominant_perspektive : undefined,
    bewertung_modell: typeof item.meta.bewertung_modell === 'string' ? item.meta.bewertung_modell : undefined,
    bewertung_stand: typeof item.meta.bewertung_stand === 'string' ? item.meta.bewertung_stand : undefined,
    prioritaets_index: typeof item.meta.prioritaets_index === 'number' ? item.meta.prioritaets_index : undefined,
    menu_order: typeof item.meta.menu_order === 'number' ? item.meta.menu_order : undefined,
    menu_area: typeof item.meta.menu_area === 'string' ? item.meta.menu_area : undefined,
    site_role: typeof item.meta.site_role === 'string' ? item.meta.site_role : undefined,
    // Session/Event-spezifische Felder
    organisation: item.meta.organisation as string | undefined,
    tags: Array.isArray(item.meta.tags) ? item.meta.tags as string[] : undefined,
    topics: Array.isArray(item.meta.topics) ? item.meta.topics as string[] : undefined,
    sourcePath: typeof item.meta.sourcePath === 'string' ? item.meta.sourcePath : undefined,
    sourceFileName: typeof item.meta.sourceFileName === 'string' ? item.meta.sourceFileName : undefined,
    textur_code: typeof item.meta.textur_code === 'string' ? item.meta.textur_code : undefined,
    group_name: typeof item.meta.group_name === 'string' ? item.meta.group_name : undefined,
    material_class: typeof item.meta.material_class === 'string' ? item.meta.material_class : undefined,
    material_type: typeof item.meta.material_type === 'string' ? item.meta.material_type : undefined,
    confidence_class: typeof item.meta.confidence_class === 'number' ? item.meta.confidence_class : undefined,
    confidence_type: typeof item.meta.confidence_type === 'number' ? item.meta.confidence_type : undefined,
    classification_locked: item.meta.classification_locked === true ? true : undefined,
    classification_rejected: item.meta.classification_rejected === true ? true : undefined,
    needs_visual_refresh: item.meta.needs_visual_refresh === true ? true : undefined,
    // RefurbedDevice-spezifische Felder fuer Gallery-Teaser (vollflaechige Karte)
    modell: typeof item.meta.modell === 'string' ? item.meta.modell : undefined,
    geraetetyp: typeof item.meta.geraetetyp === 'string' ? item.meta.geraetetyp : undefined,
    prozessor: typeof item.meta.prozessor === 'string' ? item.meta.prozessor : undefined,
    arbeitsspeicher: typeof item.meta.arbeitsspeicher === 'string' ? item.meta.arbeitsspeicher : undefined,
    festplatte: typeof item.meta.festplatte === 'string' ? item.meta.festplatte : undefined,
    grafik: typeof item.meta.grafik === 'string' ? item.meta.grafik : undefined,
    gewicht: typeof item.meta.gewicht === 'string' ? item.meta.gewicht : undefined,
    betriebssystem: typeof item.meta.betriebssystem === 'string' ? item.meta.betriebssystem : undefined,
  };
}












