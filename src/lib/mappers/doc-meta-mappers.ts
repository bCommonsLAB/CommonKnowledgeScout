/**
 * Mapper-Funktionen für doc-meta API-Responses
 * Diese Funktionen können sowohl in Client- als auch Server-Komponenten verwendet werden
 */

import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'
import type { TestimonialDetailData } from '@/components/library/testimonial-detail'
import type { ClimateActionDetailData } from '@/components/library/climate-action-detail'
import type { DivaDocumentDetailData } from '@/components/library/diva-document-detail'

/**
 * Mapper: API-Response → BookDetailData
 * Extrahiert Buch-spezifische Felder aus docMetaJson
 * 
 * Erwartet Struktur von /api/chat/${libraryId}/doc-meta:
 * {
 *   exists: boolean
 *   docMetaJson: { ... }  // Alle Buch-Felder
 *   chapters: [ ... ]      // Kapitel-Array
 *   fileName, chunkCount, upsertedAt, ...
 * }
 */
export function mapToBookDetail(input: unknown): BookDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  // Direkter Zugriff auf docMetaJson (nicht mehr verschachtelt unter .doc)
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};

  // Helper-Funktionen
  const toStr = (v: unknown): string | undefined => {
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    return undefined;
  };
  const toNum = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  const toStrArr = (v: unknown): string[] | undefined => Array.isArray(v) ? (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean) : undefined;

  const chaptersIn = Array.isArray(root.chapters) ? root.chapters as Array<unknown> : [];

  const data: BookDetailData = {
    title: toStr(docMetaJson.title) || toStr(root.fileName) || '—',
    authors: toStrArr(docMetaJson.authors) || [],
    year: ((): number | string => {
      const y = docMetaJson.year ?? root.year;
      if (typeof y === 'number') return y;
      if (typeof y === 'string' && y.trim()) return y.trim();
      return '';
    })(),
    pages: toNum(docMetaJson.pages),
    region: toStr(docMetaJson.region),
    summary: toStr(docMetaJson.summary),
    source: toStr(docMetaJson.source),
    issue: ((): string | number | undefined => {
      const i = docMetaJson.issue;
      if (typeof i === 'number') return i;
      if (typeof i === 'string' && i.trim()) return i.trim();
      return undefined;
    })(),
    language: toStr(docMetaJson.language),
    docType: toStr(docMetaJson.docType),
    commercialStatus: toStr((docMetaJson as { commercialStatus?: unknown }).commercialStatus),
    topics: toStrArr(docMetaJson.topics) || [],
    chunkCount: typeof root.chunkCount === 'number' ? root.chunkCount : undefined,
    chaptersCount: typeof root.chaptersCount === 'number' ? root.chaptersCount : undefined,
    fileId: toStr(root.fileId),
    fileName: toStr(root.fileName),
    upsertedAt: toStr(root.upsertedAt),
    markdown: toStr(docMetaJson.markdown),
    coverImageUrl: toStr((docMetaJson as { coverImageUrl?: unknown }).coverImageUrl),
    url: toStr(docMetaJson.url), // PDF-URL aus Azure Storage
    chapters: chaptersIn.map((c, i) => {
      const ch = (c && typeof c === 'object') ? c as Record<string, unknown> : {};
      const order = toNum(ch.order) ?? (i + 1);
      const level = toNum(ch.level) ?? 1;
      const title = toStr(ch.title) || toStr(ch.chapterId) || `Kapitel ${order}`;
      const startPage = toNum(ch.startPage);
      const endPage = toNum(ch.endPage);
      const summary = toStr((ch as Record<string, unknown>).summary ?? (ch as Record<string, unknown>).text);
      const kSrc = (ch as Record<string, unknown>).keywords
      const keywords = Array.isArray(kSrc) ? (kSrc as Array<unknown>).map(x => toStr(x) || '').filter(Boolean) : [];
      return { order, level, title, startPage, endPage, summary, keywords };
    }),
  };

  return data;
}

/**
 * Mapper: API-Response → SessionDetailData
 * Extrahiert Session-spezifische Felder aus docMetaJson
 * 
 * Erwartet Struktur von /api/chat/${libraryId}/doc-meta:
 * {
 *   exists: boolean
 *   docMetaJson: { ... }  // Alle Session-Felder
 *   fileName, chunkCount, upsertedAt, ...
 * }
 */
export function mapToSessionDetail(input: unknown): SessionDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  // Direkter Zugriff auf docMetaJson (nicht mehr verschachtelt unter .doc)
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};
  

  // Helper-Funktionen
  const toStr = (v: unknown): string | undefined => {
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    return undefined;
  };
  const toNum = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  
  /**
   * Konvertiert einen Wert zu einem String-Array
   * Unterstützt:
   * - Arrays (direkt)
   * - Strings die wie Arrays aussehen: "['url1', 'url2']" → ['url1', 'url2']
   * - Einzelne Strings → [string]
   */
  const toStrArr = (v: unknown): string[] | undefined => {
    // Direktes Array
    if (Array.isArray(v)) {
      const arr = (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    
    // String der wie ein Array aussieht: "['url1', 'url2']" oder '["url1", "url2"]'
    if (typeof v === 'string' && v.trim().length > 0) {
      const trimmed = v.trim();
      
      // Versuche JSON-Array zu parsen
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
          (trimmed.startsWith("['") && trimmed.endsWith("']"))) {
        try {
          // Ersetze einfache Anführungszeichen durch doppelte für JSON.parse
          const jsonStr = trimmed.replace(/'/g, '"');
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            const arr = parsed.map(x => toStr(x) || '').filter(Boolean);
            return arr.length > 0 ? arr : undefined;
          }
        } catch {
          // Fehler beim Parsen, versuche manuell zu extrahieren
          // Pattern: ['url1', 'url2'] → ['url1', 'url2']
          const matches = trimmed.match(/(['"])((?:(?!\1).)*)\1/g);
          if (matches && matches.length > 0) {
            const arr = matches.map(m => m.slice(1, -1).trim()).filter(Boolean);
            return arr.length > 0 ? arr : undefined;
          }
        }
      }
      
      // Einzelner String → als Array mit einem Element
      const singleStr = toStr(v);
      return singleStr ? [singleStr] : undefined;
    }
    
    return undefined;
  };

  // Slides aus docMetaJson.slides extrahieren
  const slidesRaw = Array.isArray(docMetaJson.slides) ? docMetaJson.slides as Array<unknown> : [];
  const slides = slidesRaw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const slide = s as Record<string, unknown>;
      return {
        page_num: typeof slide.page_num === 'number' ? slide.page_num : 0,
        title: toStr(slide.title) || `Folie ${slide.page_num || '?'}`,
        summary: toStr(slide.summary),
        image_url: toStr(slide.image_url),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const data: SessionDetailData = {
    // Basis-Felder (alle aus docMetaJson)
    title: toStr(docMetaJson.title) || toStr(root.fileName) || '—',
    shortTitle: toStr(docMetaJson.shortTitle),
    teaser: toStr(docMetaJson.teaser),
    summary: toStr(docMetaJson.summary), // Markdown-formatiert (für Retrieval)
    markdown: toStr(docMetaJson.markdown), // Markdown-Body für Detailansicht

    // Event/Publishing-spezifische Felder (optional)
    slug: toStr(docMetaJson.slug),
    docType: toStr(docMetaJson.docType),
    eventStatus: toStr((docMetaJson as { eventStatus?: unknown }).eventStatus),
    testimonialWriteKey: toStr((docMetaJson as { testimonialWriteKey?: unknown }).testimonialWriteKey),
    originalFileId: toStr((docMetaJson as { originalFileId?: unknown }).originalFileId),
    wizard_testimonial_template_id: toStr((docMetaJson as { wizard_testimonial_template_id?: unknown }).wizard_testimonial_template_id),
    wizard_finalize_template_id: toStr((docMetaJson as { wizard_finalize_template_id?: unknown }).wizard_finalize_template_id),
    
    // Session-spezifisch (alle aus docMetaJson)
    speakers: toStrArr(docMetaJson.speakers) || [],
    speakers_url: toStrArr(docMetaJson.speakers_url) || [],
    speakers_image_url: toStrArr(docMetaJson.speakers_image_url) || [],
    affiliations: toStrArr(docMetaJson.affiliations) || [],
    organisation: toStr(docMetaJson.organisation),
    tags: toStrArr(docMetaJson.tags) || [],
    topics: toStrArr(docMetaJson.topics) || [],
    
    // Zeit & Ort (alle aus docMetaJson)
    year: ((): number | string | undefined => {
      const y = docMetaJson.year;
      if (typeof y === 'number') return y;
      if (typeof y === 'string' && y.trim()) return y.trim();
      return undefined;
    })(),
    date: toStr(docMetaJson.date),
    starttime: toStr(docMetaJson.starttime),
    endtime: toStr(docMetaJson.endtime),
    duration: toStr(docMetaJson.duration) || toNum(docMetaJson.duration),
    location: toStr(docMetaJson.location),
    
    // Event-Kontext (alle aus docMetaJson)
    event: toStr(docMetaJson.event),
    track: toStr(docMetaJson.track),
    session: toStr(docMetaJson.session),
    
    // Weitere
    language: toStr(docMetaJson.language),
    
    // Links (alle aus docMetaJson)
    video_url: toStr(docMetaJson.video_url),
    attachments_url: toStr(docMetaJson.attachments_url),
    url: toStr(docMetaJson.url),
    
    // Slides
    slides: slides.length > 0 ? slides : undefined,
    
    // Technische Felder (aus root-Level)
    fileId: toStr(root.fileId),
    fileName: toStr(root.fileName),
    upsertedAt: toStr(root.upsertedAt),
    chunkCount: typeof root.chunkCount === 'number' ? root.chunkCount : undefined,
  };

  return data;
}

/**
 * Mapper: API-Response → TestimonialDetailData
 * Extrahiert Testimonial-spezifische Felder aus docMetaJson
 */
export function mapToTestimonialDetail(input: unknown): TestimonialDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};
  
  const toStr = (v: unknown): string | undefined => {
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    return undefined;
  };

  const toBool = (v: unknown): boolean | undefined => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const lower = v.toLowerCase().trim();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return undefined;
  };

  const data: TestimonialDetailData = {
    title: toStr(docMetaJson.title),
    teaser: toStr(docMetaJson.teaser),
    markdown: toStr(docMetaJson.markdown),
    
    // Fragen/Antworten
    q1_experience: toStr(docMetaJson.q1_experience),
    q2_key_insight: toStr(docMetaJson.q2_key_insight),
    q3_why_important: toStr(docMetaJson.q3_why_important),
    
    // Autor-Informationen
    author_name: toStr(docMetaJson.author_name),
    author_role: toStr(docMetaJson.author_role),
    author_nickname: toStr(docMetaJson.author_nickname),
    author_is_named: toBool(docMetaJson.author_is_named),
    author_image_url: toStr(docMetaJson.author_image_url),
    
    // Technische Felder
    fileId: toStr(root.fileId),
    fileName: toStr(root.fileName),
    upsertedAt: toStr(root.upsertedAt),
    chunkCount: typeof root.chunkCount === 'number' ? root.chunkCount : undefined,
  };

  return data;
}

/**
 * Mapper: API-Response → ClimateActionDetailData
 * Extrahiert Klimamaßnahmen-spezifische Felder aus docMetaJson
 */
export function mapToClimateActionDetail(input: unknown): ClimateActionDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};
  
  const toStr = (v: unknown): string | undefined => {
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    return undefined;
  };

  const toNum = (v: unknown): number | undefined => 
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  const toStrArr = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) {
      const arr = (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    return undefined;
  };

  const data: ClimateActionDetailData = {
    // Basis-Felder
    title: toStr(docMetaJson.title) || toStr(root.fileName) || '—',
    summary: toStr(docMetaJson.summary),
    markdown: toStr(docMetaJson.markdown),
    coverImageUrl: toStr((docMetaJson as { coverImageUrl?: unknown }).coverImageUrl),
    url: toStr(docMetaJson.url),
    
    // Klima-spezifische Felder (Template: klimamassnahme-detail)
    // massnahme_nr = Maßnahmen-Nummer
    massnahme_nr: toStr(docMetaJson.massnahme_nr),
    // lv_bewertung = Bewertung der Landesverwaltung
    lv_bewertung: toStr(docMetaJson.lv_bewertung),
    // arbeitsgruppe = Arbeitsgruppe (Energie, Mobilität, Wohnen, etc.)
    arbeitsgruppe: toStr(docMetaJson.arbeitsgruppe),
    // lv_zustaendigkeit = Zuständige Stelle (Ressort/Gemeinde)
    lv_zustaendigkeit: toStr(docMetaJson.lv_zustaendigkeit),
    
    // category mit Fallback auf handlungsfeld für ältere Daten in der DB
    category: toStr(docMetaJson.category) || toStr(docMetaJson.handlungsfeld),
    sector: toStr(docMetaJson.sector),
    region: toStr(docMetaJson.region),
    year: ((): number | string | undefined => {
      const y = docMetaJson.year;
      if (typeof y === 'number') return y;
      if (typeof y === 'string' && y.trim()) return y.trim();
      return undefined;
    })(),
    status: toStr(docMetaJson.status) || toStr(docMetaJson.lv_bewertung),
    actors: toStrArr(docMetaJson.actors),
    targetGroup: toStr(docMetaJson.targetGroup),
    co2Savings: toStr(docMetaJson.co2Savings),
    budget: toStr(docMetaJson.budget),
    timeframe: toStr(docMetaJson.timeframe),
    sdgs: toStrArr(docMetaJson.sdgs),
    tags: toStrArr(docMetaJson.tags),
    topics: toStrArr(docMetaJson.topics),
    source: toStr(docMetaJson.source),
    authors: toStrArr(docMetaJson.authors),
    
    // Technische Felder
    fileId: toStr(root.fileId),
    fileName: toStr(root.fileName),
    upsertedAt: toStr(root.upsertedAt),
    chunkCount: toNum(root.chunkCount),
  };

  return data;
}

/**
 * Mapper: API-Response → DivaDocumentDetailData
 * Extrahiert Katalogdokument-spezifische Felder aus docMetaJson
 * (Möbelbranche: Preislisten, Produktdatenblätter, Materialkollektionen)
 */
export function mapToDivaDocumentDetail(input: unknown): DivaDocumentDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};
  
  const toStr = (v: unknown): string | undefined => {
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    return undefined;
  };

  const toNum = (v: unknown): number | undefined => 
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  const toBool = (v: unknown): boolean | undefined => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const lower = v.toLowerCase().trim();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    return undefined;
  };

  const toStrArr = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) {
      const arr = (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    return undefined;
  };

  const data: DivaDocumentDetailData = {
    // Basis-Felder
    title: toStr(docMetaJson.title) || toStr(root.fileName) || '—',
    summary: toStr(docMetaJson.summary),
    markdown: toStr(docMetaJson.markdown),
    coverImageUrl: toStr((docMetaJson as { coverImageUrl?: unknown }).coverImageUrl),

    // Katalog-spezifische Felder
    dokumentTyp: toStr(docMetaJson.dokumentTyp),
    dokumentFormat: toStr(docMetaJson.dokumentFormat),
    produktname: toStr(docMetaJson.produktname),
    lieferant: toStr(docMetaJson.lieferant),
    haendler: toStr(docMetaJson.haendler),
    produktkategorien: toStrArr(docMetaJson.produktkategorien),
    materialgruppen: toStrArr(docMetaJson.materialgruppen),
    farbvarianten: toStrArr(docMetaJson.farbvarianten),
    technischeDaten: toStrArr(docMetaJson.technischeDaten),
    konfigurationsoptionen: toStrArr(docMetaJson.konfigurationsoptionen),
    gueltigAb: toStr(docMetaJson.gueltigAb),
    waehrung: toStr(docMetaJson.waehrung),
    preistyp: toStr(docMetaJson.preistyp),
    hatVkGegenstueck: toBool(docMetaJson.hatVkGegenstueck),
    istVeraltet: toBool(docMetaJson.istVeraltet),
    zertifizierungen: toStrArr(docMetaJson.zertifizierungen),
    tags: toStrArr(docMetaJson.tags),
    year: ((): number | string | undefined => {
      const y = docMetaJson.year;
      if (typeof y === 'number') return y;
      if (typeof y === 'string' && y.trim()) return y.trim();
      return undefined;
    })(),

    // Technische Felder
    fileId: toStr(root.fileId),
    fileName: toStr(root.fileName),
    upsertedAt: toStr(root.upsertedAt),
    chunkCount: toNum(root.chunkCount),
  };

  return data;
}
