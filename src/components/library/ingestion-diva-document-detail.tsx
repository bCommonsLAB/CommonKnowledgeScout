"use client";

import * as React from "react";
import { DivaDocumentDetail, type DivaDocumentDetailData } from "./diva-document-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToDivaDocumentDetail } from "@/lib/mappers/doc-meta-mappers";

interface IngestionDivaDocumentDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
  translatedData?: DivaDocumentDetailData;
  /** Callback, wenn Daten geladen wurden (für Sprachinfo im Overlay) */
  onDataLoaded?: (data: DivaDocumentDetailData) => void;
}

/**
 * Wrapper für DivaDocumentDetail, der Daten aus der MongoDB lädt.
 * 
 * Analog zu IngestionBookDetail, IngestionSessionDetail und IngestionClimateActionDetail,
 * aber für Diva-Katalogdokumente (Möbelbranche).
 */
export function IngestionDivaDocumentDetail({
  libraryId,
  fileId,
  translatedData,
  onDataLoaded,
}: IngestionDivaDocumentDetailProps) {
  const { t } = useTranslation();
  const [data, setData] = React.useState<DivaDocumentDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Ref für onDataLoaded, um Re-Renders zu vermeiden
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
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : "Dokument-Metadaten konnten nicht geladen werden"
        );
      }
      const mapped = mapToDivaDocumentDetail(json as unknown);
      setData(mapped);
      // Callback für Sprachinfo (via Ref, um Re-Renders zu vermeiden)
      if (onDataLoadedRef.current) {
        onDataLoadedRef.current(mapped);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId]);

  React.useEffect(() => {
    // Nur laden, wenn keine übersetzten Daten vorhanden sind
    if (!translatedData) {
      void load();
    }
  }, [load, translatedData]);

  // Verwende übersetzte Daten, falls vorhanden
  const displayData = translatedData || data;

  if (loading && !displayData) {
    return <div className="text-sm text-muted-foreground">{t("gallery.loading")}</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }
  if (!displayData) return null;

  return <DivaDocumentDetail data={displayData} showBackLink={false} />;
}

export default IngestionDivaDocumentDetail;
