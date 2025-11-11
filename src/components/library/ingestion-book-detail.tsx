"use client";

import * as React from "react";
import { BookDetail, type BookDetailData } from "./book-detail";
import { useTranslation } from "@/lib/i18n/hooks";

interface IngestionBookDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
}

export function IngestionBookDetail({ libraryId, fileId }: IngestionBookDetailProps) {
  const { t } = useTranslation()
  const [data, setData] = React.useState<BookDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Verwende den schnellen doc-meta Endpunkt (nur MongoDB, kein Pinecone)
      // docModifiedAt wird ignoriert, da doc-meta nur MongoDB-Daten liefert
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Dokument-Metadaten konnten nicht geladen werden');
      const mapped = mapToBookDetail(json as unknown);
      setData(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <div className="text-sm text-muted-foreground">{t('gallery.loading')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return null;

  return <BookDetail data={data} showBackLink={false} />;
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
function mapToBookDetail(input: unknown): BookDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  // Direkter Zugriff auf docMetaJson (nicht mehr verschachtelt unter .doc)
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};
  const chaptersIn = Array.isArray(root.chapters) ? root.chapters as Array<unknown> : [];

  const toStr = (v: unknown): string | undefined => typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
  const toNum = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const toStrArr = (v: unknown): string[] | undefined => Array.isArray(v) ? (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean) : undefined;

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

export default IngestionBookDetail;


