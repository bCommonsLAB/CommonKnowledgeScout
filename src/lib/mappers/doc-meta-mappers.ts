/**
 * Mapper-Funktionen für doc-meta API-Responses
 * Diese Funktionen können sowohl in Client- als auch Server-Komponenten verwendet werden
 */

import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'

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
    
    // Session-spezifisch (alle aus docMetaJson)
    speakers: toStrArr(docMetaJson.speakers) || [],
    speakers_url: toStrArr(docMetaJson.speakers_url) || [],
    speakers_image_url: toStrArr(docMetaJson.speakers_image_url) || [],
    affiliations: toStrArr(docMetaJson.affiliations) || [],
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

