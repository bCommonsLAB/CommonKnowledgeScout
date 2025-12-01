"use client";

import * as React from "react";
import { SessionDetail, type SessionDetailData } from "./session-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToSessionDetail } from "@/lib/mappers/doc-meta-mappers";

interface IngestionSessionDetailProps {
  libraryId: string;
  fileId: string;
  onDataLoaded?: (data: SessionDetailData) => void;
  translatedData?: SessionDetailData;
}

/**
 * Wrapper-Komponente für SessionDetail
 * Lädt Session-Daten via API und mappt sie auf das SessionDetailData-Format
 */
export function IngestionSessionDetail({ libraryId, fileId, onDataLoaded, translatedData }: IngestionSessionDetailProps) {
  const { t } = useTranslation()
  const [data, setData] = React.useState<SessionDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  // Ref für onDataLoaded, um Endlosschleifen zu vermeiden
  // WICHTIG: Verwende Ref direkt, um zu verhindern, dass sich der Callback ändert
  const onDataLoadedRef = React.useRef(onDataLoaded);
  React.useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);
  
  // Ref, um zu verhindern, dass onDataLoaded mehrfach für dieselben Daten aufgerufen wird
  const lastLoadedFileIdRef = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Verwende den schnellen doc-meta Endpunkt (MongoDB)
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : t('event.errorLoadingSessionData'));
      const mapped = mapToSessionDetail(json as unknown);
      setData(mapped);
      
      // Verhindere mehrfache Callbacks für dieselbe fileId
      const mappedFileId = mapped.fileId || fileId;
      if (lastLoadedFileIdRef.current === mappedFileId) {
        console.log('[IngestionSessionDetail] ⏭️ onDataLoaded bereits für diese fileId aufgerufen, überspringe:', mappedFileId);
        return;
      }
      
      lastLoadedFileIdRef.current = mappedFileId;
      
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
  }, [libraryId, fileId, t]);

  React.useEffect(() => { 
    // Nur laden, wenn keine übersetzten Daten vorhanden sind
    if (!translatedData) {
      // Reset lastLoadedFileIdRef, wenn wir neu laden
      lastLoadedFileIdRef.current = null;
      void load(); 
    }
    // Übersetzte Daten werden direkt verwendet, kein Callback nötig
    // (Callback wird nur für Original-Daten benötigt, um Übersetzung zu starten)
  }, [load, translatedData]);

  // Verwende übersetzte Daten, falls vorhanden
  const displayData = translatedData || data;

  if (loading && !displayData) return <div className="text-sm text-muted-foreground">{t('event.loadingSessionData')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!displayData) return null;

  return <SessionDetail data={displayData} showBackLink={false} libraryId={libraryId} />;
}


export default IngestionSessionDetail;

