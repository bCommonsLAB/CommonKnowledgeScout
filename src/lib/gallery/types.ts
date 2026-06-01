'use client'

import type { Item } from '@/types/item';
import type { FavoriteVoter } from '@/types/source-user-state';

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
  /** Thumbnail-URL für Galerie/Liste (256×256 WebP, center-crop aus Cover) */
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

  // ─── Klimamaßnahmen-Bewertung (LLM-Schätzung, Welle "massnahmen-graph" 1) ──
  /** Geschätztes CO₂-Einsparpotenzial in kt/Jahr (Südtirol-Maßstab). */
  co2_einsparung_kt?: number
  /** Begründung der CO₂-Größenordnung (Südtirol-Bezug). */
  co2_einsparung_kt_begruendung?: string
  /** Durchsetzbarkeit 0..1 (0 = kaum, 1 = breiter Konsens). */
  durchsetzbarkeit?: number
  /** Begründung der Durchsetzbarkeit (Widerstände, Akteure). */
  durchsetzbarkeit_begruendung?: string
  /** Geschätzte Kosten in EUR (Größenordnung). */
  kosten_eur?: number
  /** Begründung der Kostenschätzung. */
  kosten_eur_begruendung?: string
  /** Perspektive Wirkung / Emissionsminderung 0..1. */
  score_wirkung?: number
  /** Perspektive Lebensqualität & Soziales 0..1. */
  score_soziales?: number
  /** Perspektive Struktur & Rahmenbedingungen 0..1. */
  score_struktur?: number
  /** Perspektive Unterstützung & Bewusstsein 0..1. */
  score_bewusstsein?: number
  /** Begründung des Perspektiven-Profils (Südtirol-Bezug). */
  perspektiven_begruendung?: string
  /** Argmax der vier Scores: wirkung | soziales | struktur | bewusstsein. */
  dominant_perspektive?: string
  /** LLM-Modell der Bewertung (Transparenz). */
  bewertung_modell?: string
  /** Datum der Bewertung (YYYY-MM-DD). */
  bewertung_stand?: string
  /**
   * Prioritäts-Indikator (= co2 * durchsetzbarkeit / kosten, skaliert je Mio €),
   * deterministisch beim Transform berechnet und PERSISTIERT (docMetaJson).
   * Einzige Quelle der Wahrheit für Anzeige + Sortierung (keine Laufzeitformel).
   */
  prioritaets_index?: number
  /**
   * Roh-Rating (= co2 * durchsetzbarkeit / kosten), vom Server berechnet.
   * `null`/undefined = "Kosten unbekannt" oder zu wenig Daten (kein Silent
   * Fallback — sortiert mit `rating desc` ans Ende).
   */
  rating?: number | null
  /**
   * Perzentil-Score 0..100 des Ratings relativ zur geladenen Galerie-Menge
   * (client-seitig berechnet). `undefined` wenn kein gültiges Roh-Rating.
   */
  ratingPercentile?: number

  // Session/Event-spezifische Felder für Gallery-Karten
  /** Organisation des Sprechers/Events (z.B. "Universität Innsbruck") */
  organisation?: string
  /** Tags für Facettenfilter und Detail-Anzeige */
  tags?: string[]
  /** Themen/Topics für Facettenfilter und Detail-Anzeige */
  topics?: string[]

  /**
   * Beim Ingest gesetzte Herkunft (nur informativ, z. B. Tooltip) — keine Facetten.
   * Facetten weiter über pathHints / folderTrail im Template.
   */
  sourcePath?: string
  sourceFileName?: string

  /** Diva-Texture-Analysis: Kurzcode unter dem Titel (optional) */
  textur_code?: string
  /**
   * Diva-Texture-Analysis (Stufe 3/4): Klasse, Typ und Konfidenz aus Pass 1.
   * Werden in der Galerie als Badges angezeigt und ermoeglichen das Gruppieren
   * nach Stoffgruppe (`group_name`) bzw. Material-Klasse (`material_class`).
   * Optionale, flache snake_case-Felder aus dem Pass-1-Frontmatter.
   */
  group_name?: string
  material_class?: string
  material_type?: string
  confidence_class?: number
  confidence_type?: number
  /** Stufe 4: Override-Schutz fuer Einzelmaterialien. */
  classification_locked?: boolean
  /** Stufe 4: vom Klassifizierer verworfene Vorschlaege bleiben markiert. */
  classification_rejected?: boolean
  /**
   * Stufe 4/5 (Modell 2026-05-28): Marker fuer "Klasse wurde nachtraeglich
   * vom Klassifizierer korrigiert — visuelle Properties brauchen einen
   * Korrektur-Lauf, weil sie unter der alten (falschen) Klasse entstanden
   * sein koennten." Wird vom Korrektur-Lauf in Stufe 5 wieder geleert.
   */
  needs_visual_refresh?: boolean

  // ─── RefurbedDevice-spezifische Felder fuer Gallery-Teaser ───────────────
  /** Marke + Modell in einer Zeile (z.B. "Lenovo ThinkPad T480") */
  modell?: string
  /** "notebook" | "desktop-pc" | "mini-pc" | "all-in-one" */
  geraetetyp?: string
  /** Prozessor laienverstaendlich (z.B. "Intel Core i5, 8. Generation") */
  prozessor?: string
  /** Arbeitsspeicher mit Einheit (z.B. "8 GB") */
  arbeitsspeicher?: string
  /** Festplatte mit Typ (z.B. "256 GB SSD") */
  festplatte?: string
  /** Grafikkarte (z.B. "Intel-Grafik (integriert)") */
  grafik?: string
  /** Gewicht mit Einheit (z.B. "1.6 kg") */
  gewicht?: string
  /** Betriebssystem (z.B. "Linux Mint 21") */
  betriebssystem?: string

  // ─── Publish-Status (Doc-Translations Refactor) ─────────────────────────
  /** Veroeffentlichungs-Status auf Dokumentebene ('draft' | 'published'). */
  publicationStatus?: 'draft' | 'published'
  /** ISO-Zeitstempel der Veroeffentlichung (nur wenn `published`). */
  publishedAt?: string
  /**
   * Translation-Status pro Locale: pending | done | failed.
   * Wird von der Tabellenansicht als Sprach-Chips visualisiert.
   */
  translationStatus?: Record<string, 'pending' | 'done' | 'failed'>

  // ─── Doc-Translations (Galerie-Sub-Map) ──────────────────────────────────
  /**
   * Display-Labels fuer Topics in der aktiven UI-Locale.
   * Filter-Werte (`topics`) bleiben kanonisch; nur das Label wird uebersetzt.
   * Map: kanonischer Wert -> uebersetztes Label.
   */
  topicsLabels?: Record<string, string>
  /** Display-Labels fuer Tags in der aktiven UI-Locale (siehe `topicsLabels`). */
  tagsLabels?: Record<string, string>
  /** Optional: weitere Display-Labels pro Facet-Key. */
  categoryLabel?: string
  trackLabel?: string

  // ─── Sterne (per-User-State, server-side aggregiert) ────────────────────
  /**
   * Aggregierte Anzahl der `favorite`-States fuer dieses Dokument.
   * Wird vom Galerie-Endpoint per `$lookup` direkt mitgeliefert, sodass
   * keine separate Aggregation-Round-Trip pro Karte noetig ist.
   * Default-Wert (auch fuer Nicht-Member): `0`.
   */
  favoriteCount?: number
  /**
   * Voter-Liste fuer den Tooltip ("wer hat gesternt"). Display-Names sind
   * zur Schreibzeit eingefroren, sodass der Read-Pfad keinen Auth-Provider
   * mehr fragen muss. Bei Nicht-Member: leeres Array.
   */
  favoriteVoters?: FavoriteVoter[]
  /**
   * Eigener Stern fuer den aktuellen User. Optional; wenn nicht gesetzt
   * (z.B. anonyme User), behandelt die UI das als `false`.
   */
  isFavorite?: boolean
  /**
   * Aggregierte Anzahl nicht-geloeschter Kommentare fuer dieses Dokument.
   * Wird vom Galerie-Endpoint per `$lookup` mitgeliefert (member-only, wie
   * die Sterne). Default/Nicht-Member: `undefined` -> UI behandelt als 0.
   */
  commentCount?: number
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












