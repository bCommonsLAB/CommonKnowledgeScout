"use client";

import * as React from "react";
import { SessionDetail, type SessionDetailData } from "./session-detail";

interface IngestionSessionDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
}

/**
 * Wrapper-Komponente für SessionDetail
 * Lädt Session-Daten via API und mappt sie auf das SessionDetailData-Format
 */
export function IngestionSessionDetail({ libraryId, fileId, docModifiedAt }: IngestionSessionDetailProps) {
  const [data, setData] = React.useState<SessionDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Verwende den schnellen doc-meta Endpunkt (nur MongoDB, kein Pinecone)
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      console.log('[IngestionSessionDetail] Loading data from:', url);
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      console.log('[IngestionSessionDetail] API Response:', { ok: res.ok, dataKeys: Object.keys(json) });
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Session-Daten konnten nicht geladen werden');
      const mapped = mapToSessionDetail(json as unknown);
      console.log('[IngestionSessionDetail] Mapped Data:', {
        hasTitle: !!mapped.title,
        hasSpeakers: !!mapped.speakers && mapped.speakers.length > 0,
        hasEvent: !!mapped.event,
        hasSlides: !!mapped.slides && mapped.slides.length > 0,
        hasSummary: !!mapped.summary,
        summaryLength: mapped.summary?.length || 0
      });
      setData(mapped);
    } catch (e) {
      console.error('[IngestionSessionDetail] Error:', e);
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId, docModifiedAt]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <div className="text-sm text-muted-foreground">Lade Session-Daten…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return null;

  return <SessionDetail data={data} showBackLink={false} />;
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
function mapToSessionDetail(input: unknown): SessionDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  // Direkter Zugriff auf docMetaJson (nicht mehr verschachtelt unter .doc)
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object') 
    ? root.docMetaJson as Record<string, unknown> 
    : {};
  
  // Debug: Zeige die Struktur
  console.log('[mapToSessionDetail] Input Structure:', {
    hasRoot: !!root,
    hasDocMetaJson: !!docMetaJson,
    rootKeys: Object.keys(root),
    docMetaJsonKeys: Object.keys(docMetaJson),
    speakersInDocMetaJson: docMetaJson.speakers,
    eventInDocMetaJson: docMetaJson.event,
    slidesInDocMetaJson: Array.isArray(docMetaJson.slides) ? docMetaJson.slides.length : 'not array',
    summaryLength: typeof docMetaJson.summary === 'string' ? docMetaJson.summary.length : 0
  });

  // Helper-Funktionen
  const toStr = (v: unknown): string | undefined => typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
  const toNum = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const toStrArr = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const arr = (v as Array<unknown>).map(x => toStr(x) || '').filter(Boolean);
    return arr.length > 0 ? arr : undefined;
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
    summary: toStr(docMetaJson.summary), // Markdown-formatiert
    
    // Session-spezifisch (alle aus docMetaJson)
    speakers: toStrArr(docMetaJson.speakers) || [],
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
  
  console.log('[mapToSessionDetail] Final Data:', {
    title: data.title,
    speakers: data.speakers,
    event: data.event,
    track: data.track,
    slides: data.slides?.length || 0,
    summary: data.summary?.substring(0, 100) + '...'
  });

  return data;
}

export default IngestionSessionDetail;

