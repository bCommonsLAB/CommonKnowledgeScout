"use client";

import * as React from "react";
import { ClimateActionDetail, type ClimateActionDetailData } from "./climate-action-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToClimateActionDetail } from "@/lib/mappers/doc-meta-mappers";

interface IngestionClimateActionDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
  translatedData?: ClimateActionDetailData;
  /** Callback, wenn Daten geladen wurden (für Sprachinfo im Overlay) */
  onDataLoaded?: (data: ClimateActionDetailData) => void;
}

/**
 * Wrapper für ClimateActionDetail, der Daten aus der MongoDB lädt.
 * 
 * Analog zu IngestionBookDetail und IngestionSessionDetail,
 * aber für ClimateAction-Dokumente (Klimamaßnahmen).
 */
export function IngestionClimateActionDetail({ 
  libraryId, 
  fileId, 
  translatedData,
  onDataLoaded,
}: IngestionClimateActionDetailProps) {
  const { t } = useTranslation()
  const [data, setData] = React.useState<ClimateActionDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  // Ref für onDataLoaded, um Re-Renders zu vermeiden
  // Der Callback ändert sich bei jedem Parent-Render, aber wir wollen nicht
  // dass das einen neuen API-Call auslöst
  const onDataLoadedRef = React.useRef(onDataLoaded);
  React.useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Verwende den schnellen doc-meta Endpunkt (MongoDB)
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Dokument-Metadaten konnten nicht geladen werden');
      const mapped = mapToClimateActionDetail(json as unknown);
      setData(mapped);
      // Callback für Sprachinfo (via Ref, um Re-Renders zu vermeiden)
      if (onDataLoadedRef.current) {
        onDataLoadedRef.current(mapped);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId]); // onDataLoaded entfernt - verwende Ref stattdessen

  React.useEffect(() => { 
    // Nur laden, wenn keine übersetzten Daten vorhanden sind
    if (!translatedData) {
      void load(); 
    }
  }, [load, translatedData]);

  // Verwende übersetzte Daten, falls vorhanden
  const displayData = translatedData || data;

  if (loading && !displayData) return <div className="text-sm text-muted-foreground">{t('gallery.loading')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!displayData) return null;

  return <ClimateActionDetail data={displayData} showBackLink={false} />;
}

export default IngestionClimateActionDetail;
