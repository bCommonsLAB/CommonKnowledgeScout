/**
 * @fileoverview Zentrale Registry für DetailViewTypes
 * 
 * @description
 * Diese Datei definiert alle verfügbaren DetailViewTypes zentral an einem Ort.
 * Sie enthält:
 * - Die Liste aller gültigen ViewTypes
 * - Pflichtfelder und optionale Felder pro ViewType
 * - Zod-Schema für Validierung
 * - Validierungsfunktionen
 * 
 * @module detail-view-types
 * 
 * @usedIn
 * - src/lib/external-jobs/phase-template.ts (Pipeline-Contract)
 * - src/components/templates/structured-template-editor.tsx (Vorlagenverwaltung)
 * - src/components/library/detail-view-renderer.tsx (Story-Vorschau)
 * - src/components/library/gallery/detail-overlay.tsx (Galerie)
 */

import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════════════════════
// ZENTRALE DEFINITION ALLER VIEWTYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Alle verfügbaren DetailViewTypes als const Array.
 * Dies ist die einzige Stelle, an der neue ViewTypes hinzugefügt werden müssen.
 */
export const DETAIL_VIEW_TYPES = ['book', 'session', 'testimonial', 'blog', 'climateAction', 'divaDocument'] as const

/**
 * Union Type aller gültigen DetailViewTypes.
 * Abgeleitet aus dem DETAIL_VIEW_TYPES Array.
 */
export type DetailViewType = typeof DETAIL_VIEW_TYPES[number]

/**
 * Zod-Schema für DetailViewType-Validierung.
 * Kann in API-Routes und Forms verwendet werden.
 */
export const detailViewTypeSchema = z.enum(DETAIL_VIEW_TYPES)

/**
 * Prüft ob ein Wert ein gültiger DetailViewType ist.
 * Type Guard für Runtime-Checks.
 */
export function isValidDetailViewType(value: unknown): value is DetailViewType {
  return typeof value === 'string' && DETAIL_VIEW_TYPES.includes(value as DetailViewType)
}

// ═══════════════════════════════════════════════════════════════════════════════
// KONFIGURATION PRO VIEWTYPE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Medien-Konfiguration pro ViewType.
 * Steuert welche Medien-Sektionen im Medien-Tab angezeigt werden.
 */
export interface ViewTypeMediaConfig {
  /** Zeigt die Coverbild-Sektion (coverImageUrl) */
  coverImage: boolean
  /** Personen-Sektion mit Index-basierten Bildern (z.B. Sprecher, Autoren) */
  personField?: {
    /** Frontmatter-Key für die Personen-Liste (z.B. 'speakers', 'authors') */
    listKey: string
    /** Frontmatter-Key für die Bild-URLs (z.B. 'speakers_image_url', 'authors_image_url') */
    imageKey: string
    /** UI-Label für die Sektion (z.B. 'Sprecher', 'Autoren') */
    label: string
  }
  /** Zeigt die Anhänge-Sektion (attachments_url als string[]) */
  attachments: boolean
  /** Zeigt die URL-Sektion (url-Feld, zuordenbar über .url-Dateien im Verzeichnis) */
  urlField: boolean
}

/**
 * Konfiguration für einen DetailViewType.
 * Definiert Pflichtfelder, optionale Felder und UI-Eigenschaften.
 */
export interface ViewTypeConfig {
  /** Pflichtfelder, die im Frontmatter vorhanden sein müssen */
  requiredFields: string[]
  /** Optionale Felder, die die Anzeige verbessern */
  optionalFields: string[]
  /** i18n-Schlüssel für das Label (z.B. "Book", "Session") */
  labelKey: string
  /** i18n-Schlüssel für die Beschreibung */
  descriptionKey: string
  /** Medien-Konfiguration für den Medien-Tab */
  mediaConfig: ViewTypeMediaConfig
}

/**
 * Registry mit Konfiguration für jeden DetailViewType.
 * 
 * Pflichtfelder:
 * - Müssen im transformierten Frontmatter vorhanden sein
 * - Pipeline-Contract warnt wenn sie fehlen
 * - Story-Vorschau zeigt Warnung wenn sie fehlen
 * 
 * Optionale Felder:
 * - Verbessern die Anzeige, sind aber nicht kritisch
 * - Werden in der Vorlagenverwaltung als "empfohlen" angezeigt
 */
export const VIEW_TYPE_REGISTRY: Record<DetailViewType, ViewTypeConfig> = {
  book: {
    requiredFields: ['title', 'language', 'targetLanguage'],
    optionalFields: ['summary', 'authors', 'authors_image_url', 'year', 'coverImageUrl', 'chapters', 'pages', 'region', 'topics', 'tags', 'docType', 'source'],
    labelKey: 'gallery.detailViewTypeBook',
    descriptionKey: 'gallery.detailViewTypeBookDescription',
    mediaConfig: {
      coverImage: true,
      personField: { listKey: 'authors', imageKey: 'authors_image_url', label: 'Autoren' },
      attachments: false,
      urlField: true,
    },
  },
  session: {
    requiredFields: ['title', 'language', 'targetLanguage'],
    optionalFields: [
      'summary',
      'teaser',
      'speakers',
      'speakers_image_url',
      'speakers_url',
      'affiliations',
      'organisation',
      'date',
      'year',
      'event',
      'track',
      'location',
      'video_url',
      'coverImageUrl',
      'attachments_url',
      'attachment_links',
      'url',
      'ecosocial',
      'slides',
      'tags',
      'topics',
    ],
    labelKey: 'gallery.detailViewTypeSession',
    descriptionKey: 'gallery.detailViewTypeSessionDescription',
    mediaConfig: {
      coverImage: true,
      personField: { listKey: 'speakers', imageKey: 'speakers_image_url', label: 'Sprecher' },
      attachments: true,
      urlField: true,
    },
  },
  testimonial: {
    requiredFields: ['title', 'author_name', 'language', 'targetLanguage'],
    optionalFields: ['q1_experience', 'q2_key_insight', 'q3_why_important', 'author_image_url', 'author_role'],
    labelKey: 'gallery.detailViewTypeTestimonial',
    descriptionKey: 'gallery.detailViewTypeTestimonialDescription',
    mediaConfig: {
      coverImage: false,
      personField: { listKey: 'author_name', imageKey: 'author_image_url', label: 'Autor' },
      attachments: false,
      urlField: false,
    },
  },
  blog: {
    requiredFields: ['title', 'language', 'targetLanguage'],
    optionalFields: ['summary', 'authors', 'coverImageUrl', 'teaser', 'tags'],
    labelKey: 'gallery.detailViewTypeBlog',
    descriptionKey: 'gallery.detailViewTypeBlogDescription',
    mediaConfig: {
      coverImage: true,
      attachments: false,
      urlField: true,
    },
  },
  climateAction: {
    requiredFields: ['title', 'category', 'language', 'targetLanguage'],
    optionalFields: [
      'summary',
      'massnahme_nr',
      'lv_bewertung',
      'arbeitsgruppe',
      'lv_zustaendigkeit',
      'tags',
      'coverImageUrl',
    ],
    labelKey: 'gallery.detailViewTypeClimateAction',
    descriptionKey: 'gallery.detailViewTypeClimateActionDescription',
    mediaConfig: {
      coverImage: true,
      attachments: false,
      urlField: false,
    },
  },
  divaDocument: {
    requiredFields: ['title', 'dokumentTyp', 'produktname', 'lieferant', 'language', 'targetLanguage'],
    optionalFields: [
      'summary',
      'haendler',
      'produktkategorien',
      'gueltigAb',
      'istVeraltet',
      'dokumentFormat',
      'materialgruppen',
      'waehrung',
      'preistyp',
      'zertifizierungen',
      'tags',
      'coverImageUrl',
    ],
    labelKey: 'gallery.detailViewTypeDivaDocument',
    descriptionKey: 'gallery.detailViewTypeDivaDocumentDescription',
    mediaConfig: {
      coverImage: true,
      attachments: false,
      urlField: true,
    },
  },
}

/**
 * Hilfsfunktion: Holt die Konfiguration für einen ViewType.
 * Gibt undefined zurück wenn der ViewType nicht existiert.
 */
export function getViewTypeConfig(viewType: string): ViewTypeConfig | undefined {
  if (!isValidDetailViewType(viewType)) return undefined
  return VIEW_TYPE_REGISTRY[viewType]
}

/**
 * Hilfsfunktion: Holt alle Pflichtfelder für einen ViewType.
 * Gibt leeres Array zurück wenn der ViewType nicht existiert.
 */
export function getRequiredFields(viewType: string): string[] {
  const config = getViewTypeConfig(viewType)
  return config?.requiredFields ?? []
}

/**
 * Hilfsfunktion: Holt alle optionalen Felder für einen ViewType.
 * Gibt leeres Array zurück wenn der ViewType nicht existiert.
 */
export function getOptionalFields(viewType: string): string[] {
  const config = getViewTypeConfig(viewType)
  return config?.optionalFields ?? []
}

/**
 * Spalten-Definition für die Galerie-Tabellenansicht.
 * labelKey ist der i18n-Schlüssel (z.B. gallery.table.title).
 */
export interface TableColumnDef {
  key: string
  labelKey: string
}

/** Standard-Spalten wenn kein DetailViewType oder für Rückwärtskompatibilität */
const DEFAULT_TABLE_COLUMNS: TableColumnDef[] = [
  { key: 'title', labelKey: 'gallery.table.title' },
  { key: 'year', labelKey: 'gallery.table.year' },
  { key: 'track', labelKey: 'gallery.table.track' },
  { key: 'upsertedAt', labelKey: 'gallery.table.upsertedAt' },
]

/**
 * Liefert die Tabellenspalten für die Galerie-Tabellenansicht basierend auf dem DetailViewType.
 * Reihenfolge: Titel, Pflichtfelder (ohne title), optionale Felder, upsertedAt.
 * Die erste Spalte (Thumbnail) wird in der UI ergänzt, nicht hier.
 */
export function getTableColumnsForViewType(viewType: string | undefined): TableColumnDef[] {
  if (!viewType || !isValidDetailViewType(viewType)) {
    return DEFAULT_TABLE_COLUMNS
  }
  const config = VIEW_TYPE_REGISTRY[viewType as DetailViewType]
  if (!config) return DEFAULT_TABLE_COLUMNS

  const required = config.requiredFields.filter((k) => k !== 'title')
  const optional = config.optionalFields
  const keys = ['title', ...required, ...optional, 'upsertedAt']
  const seen = new Set<string>()
  const columns: TableColumnDef[] = []
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    columns.push({ key, labelKey: `gallery.table.${key}` })
  }
  return columns
}
