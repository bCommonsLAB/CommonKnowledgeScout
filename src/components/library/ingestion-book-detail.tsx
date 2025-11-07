"use client";

import * as React from "react";
import { BookDetail, type BookDetailData } from "./book-detail";
import { useTranslation } from "@/lib/i18n/hooks";

interface IngestionBookDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
}

export function IngestionBookDetail({ libraryId, fileId, docModifiedAt }: IngestionBookDetailProps) {
  const { t } = useTranslation()
  const [data, setData] = React.useState<BookDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/chat/${encodeURIComponent(libraryId)}/ingestion-status?fileId=${encodeURIComponent(fileId)}${docModifiedAt ? `&docModifiedAt=${encodeURIComponent(docModifiedAt)}` : ''}&stats=1`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Ingestion-Status konnte nicht geladen werden');
      const mapped = mapToBookDetail(json as unknown);
      setData(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId, docModifiedAt]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <div className="text-sm text-muted-foreground">{t('gallery.loading')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return null;

  return <BookDetail data={data} showBackLink={false} />;
}

function mapToBookDetail(input: unknown): BookDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const doc = (root.doc && typeof root.doc === 'object') ? root.doc as Record<string, unknown> : {};
  const chaptersIn = Array.isArray(root.chapters) ? root.chapters as Array<unknown> : [];

  const toStr = (v: unknown): string | undefined => typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
  const toNum = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const toStrArr = (v: unknown): string[] | undefined => Array.isArray(v) ? (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean) : undefined;

  const data: BookDetailData = {
    title: toStr(doc.title) || toStr(doc.fileName) || '—',
    authors: toStrArr(doc.authors) || [],
    year: ((): number | string | undefined => {
      if (typeof doc.year === 'number') return doc.year;
      if (typeof doc.year === 'string' && doc.year.trim()) return doc.year.trim();
      return undefined;
    })() ?? '',
    pages: toNum(doc.pages),
    region: toStr(doc.region),
    summary: toStr(doc.summary),
    source: toStr(doc.source),
    issue: ((): string | number | undefined => {
      if (typeof doc.issue === 'number') return doc.issue;
      if (typeof doc.issue === 'string' && doc.issue.trim()) return doc.issue.trim();
      return undefined;
    })(),
    language: toStr(doc.language),
    docType: toStr(doc.docType),
    commercialStatus: toStr((doc as { commercialStatus?: unknown }).commercialStatus),
    topics: toStrArr(doc.topics) || [],
    chunkCount: typeof doc.chunkCount === 'number' ? (doc.chunkCount as number) : undefined,
    chaptersCount: typeof doc.chaptersCount === 'number' ? (doc.chaptersCount as number) : undefined,
    fileId: toStr((doc as { fileId?: unknown }).fileId) || toStr((root as { fileId?: unknown }).fileId),
    fileName: toStr(doc.fileName),
    upsertedAt: toStr((doc as { upsertedAt?: unknown }).upsertedAt),
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


