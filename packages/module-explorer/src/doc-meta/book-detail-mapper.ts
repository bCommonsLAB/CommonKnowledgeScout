/**
 * Die Buch-Detailansicht in Daten: der Vertrag (`BookDetailData`, `Chapter`)
 * und der Mapper aus der doc-meta-Antwort.
 *
 * Seit M5 im Paket, weil die Buch-Ansicht des Embeds ihn braucht. Vorher lagen
 * die Typen in `src/components/library/book-detail.tsx` und der Mapper in
 * `src/lib/mappers/doc-meta-mappers.ts`; beide Stellen re-exportieren weiter
 * (der Server uebersetzt damit in `phase-translations.ts`). Ohne React und
 * ohne Locale: Die Sprach-Veredelung (`localizeDocMetaJson`) passiert vorher.
 */

export interface Chapter {
  order: number;
  level: number;
  title: string;
  startPage?: number;
  endPage?: number;
  summary?: string;
  keywords?: string[];
}

export interface BookDetailData {
  title: string;
  authors: string[];
  /** Autoren-Bilder, Index-basiert gemappt auf authors[] */
  authors_image_url?: string[];
  year: number | string;
  pages?: number;
  region?: string;
  summary?: string;
  source?: string;
  issue?: string | number;
  language?: string;
  docType?: string;
  commercialStatus?: string;
  topics?: string[];
  chapters?: Chapter[];
  chunkCount?: number;
  chaptersCount?: number;
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  markdown?: string;
  coverImageUrl?: string;
  /** Generische URL: kann PDF-URL oder Web-Link sein */
  url?: string;
  /** Anhänge (Dokumente, PDFs, etc.) */
  attachments_url?: string[];
}

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
    authors_image_url: toStrArr(docMetaJson.authors_image_url),
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
    url: toStr(docMetaJson.url),
    attachments_url: (() => {
      const raw = docMetaJson.attachments_url
      if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      if (typeof raw === 'string' && raw.trim().length > 0) return [raw.trim()]
      return undefined
    })(),
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
