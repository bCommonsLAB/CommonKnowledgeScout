"use client";

import * as React from "react";
import { SessionDetail, type SessionDetailData } from "./session-detail";

interface IngestionSessionDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
  onDataLoaded?: (data: SessionDetailData) => void;
}

/**
 * Wrapper-Komponente für SessionDetail
 * Lädt Session-Daten via API und mappt sie auf das SessionDetailData-Format
 */
export function IngestionSessionDetail({ libraryId, fileId, docModifiedAt, onDataLoaded }: IngestionSessionDetailProps) {
  const [data, setData] = React.useState<SessionDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  // Ref für onDataLoaded, um Endlosschleifen zu vermeiden
  const onDataLoadedRef = React.useRef(onDataLoaded);
  React.useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Verwende den schnellen doc-meta Endpunkt (nur MongoDB, kein Pinecone)
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Session-Daten konnten nicht geladen werden');
      const mapped = mapToSessionDetail(json as unknown);
      setData(mapped);
      // Callback aufrufen, wenn Daten geladen wurden (nach setState)
      if (onDataLoadedRef.current) {
        // Verwende setTimeout, um sicherzustellen, dass State gesetzt ist
        setTimeout(() => {
          onDataLoadedRef.current?.(mapped);
        }, 0);
      }
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

  return <SessionDetail data={data} showBackLink={false} libraryId={libraryId} />;
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

export default IngestionSessionDetail;

