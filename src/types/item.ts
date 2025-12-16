/**
 * @fileoverview Item Type Definitions - Generisches Item-Modell
 * 
 * @description
 * Definiert das generische Item-Modell für alle Item-Typen (Document, Event, JobOffer, Testimonial, etc.).
 * Ein Item ist die kanonische, normalisierte Repräsentation eines Wissensobjekts in einer Library.
 * 
 * In Variante 1 entspricht ein Item logisch dem MetaDocument (kind: 'meta') in der Vector-Collection.
 * 
 * @module item
 * 
 * @exports
 * - Item: Generisches Item-Interface
 * - ItemType: Bekannte Item-Typen
 * - Attachment: Binärartefakt (Bild, Slide, Audio)
 * - mapMetaDocumentToItem: Mapping-Funktion von MetaDocument zu Item
 * 
 * @usedIn
 * - src/lib/ingestion/meta-document-builder.ts: MetaDocument wird zu Item gemappt
 * - src/components/library: Library-Komponenten verwenden Item-Typen
 * - src/lib/gallery: Gallery-Komponenten verwenden Item-Typen
 * 
 * @dependencies
 * - @/lib/ingestion/meta-document-builder: MetaDocument-Typ
 * - @/types/doc-meta: ChapterMetaEntry-Typ
 */

import type { MetaDocument } from '@/lib/ingestion/meta-document-builder';
import type { ChapterMetaEntry } from '@/types/doc-meta';

/**
 * Bekannte Item-Typen.
 * Jeder Item-Typ hat unterschiedliche Metadaten-Felder und Verhalten.
 */
export type ItemType = 'document' | 'event' | 'joboffer' | 'testimonial';

/**
 * Binärartefakt (Bild, Slide, Audio) mit Azure-URL.
 * Alle Binärartefakte werden auf Azure Blob Storage gespeichert,
 * nicht mehr im Filesystem/Storage-Provider.
 */
export interface Attachment {
  /** Art des Artefakts */
  kind: 'image' | 'audio' | 'pdf' | 'slide';
  /** Azure Blob Storage URL */
  url: string;
  /** Rolle des Artefakts (z.B. cover, page-image, slide-preview) */
  role?: string;
  /** Zusätzliche Metadaten */
  metadata?: Record<string, unknown>;
}

/**
 * Generisches Item-Interface.
 * Repräsentiert ein normalisiertes Wissensobjekt in einer Library.
 * 
 * In Variante 1 entspricht ein Item logisch dem MetaDocument (kind: 'meta')
 * in der Vector-Collection vectors__<libraryId>.
 */
export interface Item {
  /** Eindeutige ID des Items (= fileId) */
  id: string;
  
  /** Library-ID, zu der das Item gehört */
  libraryId: string;
  
  /** User-Email des Besitzers */
  user: string;
  
  /** Dateiname des Original-Dokuments */
  fileName: string;
  
  /** Item-Typ (Document, Event, JobOffer, Testimonial, etc.) */
  docType: ItemType | string; // string für zukünftige Typen
  
  /** Optional: Parent-Item-ID für Hierarchien (z.B. testimonial.parentId = event.id) */
  parentId?: string;
  
  /** Optional: Parent-Item-Slug für Hierarchien (alternativ zu parentId) */
  parentSlug?: string;
  
  /** Herkunft des Items (upload, scraped_url, spoken_text, testimonial_form, etc.) */
  source: string;
  
  /** Strukturierte Metadaten (Frontmatter-Felder, ohne markdown) */
  meta: Record<string, unknown>;
  
  /** Vollständiger Text-Body als Markdown (mit Azure-URLs für Bilder) */
  markdown: string;
  
  /** Binärartefakte (Bilder, Slides, Audio) – alle auf Azure Storage */
  attachments?: Attachment[];
  
  /** Kapitel-Struktur (für Dokumente mit Kapiteln) */
  chapters?: ChapterMetaEntry[];
  
  /** Anzahl der Kapitel */
  chaptersCount: number;
  
  /** Anzahl der Chunks (für RAG) */
  chunkCount: number;
  
  /** Facetten-Metadaten (denormalisiert für Filterung) */
  year?: number;
  authors?: string[];
  tags?: string[];
  topics?: string[];
  region?: string;
  // ... weitere library-spezifische Facetten über [key: string]: unknown
  
  /** Zeitstempel der letzten Aktualisierung */
  upsertedAt: string;
  
  /** Optional: Dokument-Embedding für globale Dokumentensuche */
  embedding?: number[];
  
  /** Dynamische Felder für library-spezifische Facetten */
  [key: string]: unknown;
}

/**
 * Mappt ein MetaDocument zu einem Item.
 * 
 * Diese Funktion ist eine reine Typ-/Struktur-Mapping-Funktion,
 * keine DB-Operationen. Sie konvertiert die interne MetaDocument-Struktur
 * in das generische Item-Modell.
 * 
 * @param meta MetaDocument aus der Vector-Collection
 * @returns Item-Repräsentation
 */
export function mapMetaDocumentToItem(meta: MetaDocument): Item {
  // Extrahiere markdown aus docMetaJson
  const markdown = typeof meta.docMetaJson?.markdown === 'string'
    ? meta.docMetaJson.markdown
    : '';
  
  // Extrahiere meta ohne markdown
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { markdown: _unused_markdown, ...metaWithoutMarkdown } = meta.docMetaJson || {};
  
  // Baue attachments aus docMetaJson (slides, coverImageUrl, etc.)
  const attachments: Attachment[] = [];
  
  // Slides als Attachments
  if (Array.isArray(meta.docMetaJson?.slides)) {
    const slides = meta.docMetaJson.slides as Array<Record<string, unknown>>;
    for (const slide of slides) {
      if (typeof slide.url === 'string') {
        attachments.push({
          kind: 'slide',
          url: slide.url,
          role: typeof slide.role === 'string' ? slide.role : undefined,
          metadata: slide,
        });
      }
    }
  }
  
  // Cover-Bild als Attachment
  if (typeof meta.docMetaJson?.coverImageUrl === 'string') {
    attachments.push({
      kind: 'image',
      url: meta.docMetaJson.coverImageUrl,
      role: 'cover',
    });
  }
  
  // Baue Item-Objekt
  const item: Item = {
    id: meta.fileId,
    libraryId: meta.libraryId,
    user: meta.user,
    fileName: meta.fileName,
    docType: meta.docType || 'document',
    parentId: typeof meta.docMetaJson?.parentId === 'string' ? meta.docMetaJson.parentId : undefined,
    parentSlug: typeof meta.docMetaJson?.parentSlug === 'string' ? meta.docMetaJson.parentSlug : undefined,
    source: meta.source || 'unknown',
    meta: metaWithoutMarkdown,
    markdown,
    attachments: attachments.length > 0 ? attachments : undefined,
    chapters: meta.chapters,
    chaptersCount: meta.chaptersCount,
    chunkCount: meta.chunkCount,
    year: meta.year,
    authors: meta.authors,
    tags: meta.tags,
    topics: meta.topics,
    region: meta.region,
    upsertedAt: meta.upsertedAt,
    embedding: meta.embedding,
  };
  
  // Kopiere alle weiteren dynamischen Felder aus MetaDocument
  for (const [key, value] of Object.entries(meta)) {
    if (!(key in item)) {
      item[key] = value;
    }
  }
  
  return item;
}

/**
 * Bekannte Item-Typen als Map für Validierung/Filterung.
 */
export const KNOWN_ITEM_TYPES: Record<ItemType, string> = {
  document: 'Dokument',
  event: 'Event',
  joboffer: 'Stellenanzeige',
  testimonial: 'Testimonial',
};

/**
 * Prüft, ob ein Item-Typ bekannt ist.
 */
export function isKnownItemType(docType: string): docType is ItemType {
  return docType in KNOWN_ITEM_TYPES;
}









