import type { Locale } from '@/lib/i18n';

export interface ChapterMetaEntry {
  index: number;
  id?: string;
  title?: string;
  summary?: string;
  chunkCount?: number;
  level?: number;
  startPage?: number;
  endPage?: number;
  pageCount?: number;
  keywords?: string[];
}

/**
 * Publikations-Metadaten eines einzelnen Dokuments.
 *
 * Wird in `docMetaJson.publication` gespeichert. Steuert, ob ein Dokument
 * fuer alle Benutzer (auch in der oeffentlichen Library) sichtbar ist und
 * triggert die parallelen Uebersetzungsjobs.
 */
export interface DocPublicationMeta {
  /** 'draft' = nur fuer Autor sichtbar, 'published' = oeffentlich + uebersetzt */
  status: 'draft' | 'published';
  /** ISO-Zeitpunkt der letzten Publikation */
  publishedAt?: string;
  /** Email/User, der publiziert hat */
  publishedBy?: string;
}

/**
 * Status der Uebersetzung pro Sprache.
 *
 * - `pending`: Job wurde enqueued, laeuft aber noch
 * - `done`: Uebersetzung erfolgreich in `docMetaJson.translations` geschrieben
 * - `failed`: Job mit Fehler abgebrochen, `translationError` enthaelt Details
 */
export type DocTranslationStatus = 'pending' | 'done' | 'failed'

/**
 * Galerie-relevante Felder einer Sprachuebersetzung.
 *
 * Bewusst klein gehalten, damit die Galerie-API mit aktiver Locale-Projection
 * nicht durch grosse Markdown-Bloecke belastet wird (siehe Plan, Performance-Sanity-Check).
 */
export interface GalleryTranslatedFields {
  title?: string;
  shortTitle?: string;
  teaser?: string;
  category?: string;
  track?: string;
  /** Fuer topicLike-Felder: Map kanonischer Wert -> uebersetztes Display-Label */
  topicsLabels?: Record<string, string>;
  tagsLabels?: Record<string, string>;
  /** Optional: weitere Display-Label-Maps pro Facet-Key */
  [labelMapKey: string]: unknown;
}

/**
 * Detail-relevante Felder einer Sprachuebersetzung (gross, nur fuer Detailansicht laden).
 */
export interface DetailTranslatedFields {
  summary?: string;
  markdown?: string;
  authors?: string[];
  speakers?: string[];
  chapters?: Array<{
    title?: string;
    summary?: string;
    keywords?: string[];
  }>;
  /** Quellsprache, aus der uebersetzt wurde (informativ) */
  sourceLanguage?: string;
  /** ISO-Zeitpunkt des Uebersetzungs-Abschlusses */
  translatedAt?: string;
  /** Verwendetes LLM-Modell (informativ) */
  translationModel?: string;
  /** Schema-Version, falls wir spaeter migrieren muessen */
  cacheVersion?: number;
  /** Erweiterbar fuer custom Detail-Felder */
  [extraKey: string]: unknown;
}

/**
 * Komplettes Translations-Objekt im Dokumentenmeta.
 *
 * Aufteilung in `gallery` und `detail` ist eine Performance-Optimierung:
 * Der Galerie-Endpunkt projiziert nur `translations.gallery.<locale>`,
 * der Detail-Endpunkt zusaetzlich `translations.detail.<locale>`.
 */
export interface DocTranslationsMeta {
  gallery?: Partial<Record<Locale, GalleryTranslatedFields>>;
  detail?: Partial<Record<Locale, DetailTranslatedFields>>;
}

export interface DocMeta {
  user: string;
  libraryId: string;
  fileId: string;
  fileName?: string;
  chunkCount: number;
  chaptersCount: number;
  upsertedAt: string;
  docMetaJson?: Record<string, unknown>;
  chapters?: ChapterMetaEntry[];
  // Dynamische, library-spezifische Metadaten-Felder (per Facet-Defs)
  [key: string]: unknown;
}

export interface DocMetaFilters {
  authors?: string[];
  region?: string[];
  year?: (number | string)[];
  docType?: string[];
  source?: string[];
  tags?: string[];
}


