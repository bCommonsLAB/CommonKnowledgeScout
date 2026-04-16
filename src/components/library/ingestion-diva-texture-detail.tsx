"use client";

import * as React from "react";
import { DivaTextureDetail, type DivaTextureDetailData } from "./diva-texture-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToDivaTextureDetail } from "@/lib/mappers/doc-meta-mappers";

interface IngestionDivaTextureDetailProps {
  libraryId: string;
  fileId: string;
  translatedData?: DivaTextureDetailData;
  onDataLoaded?: (data: DivaTextureDetailData) => void;
}

/**
 * Lädt doc-meta für publizierte Textur-Analysen und rendert {@link DivaTextureDetail}.
 */
export function IngestionDivaTextureDetail({
  libraryId,
  fileId,
  translatedData,
  onDataLoaded,
}: IngestionDivaTextureDetailProps) {
  const { t } = useTranslation();
  const [data, setData] = React.useState<DivaTextureDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onDataLoadedRef = React.useRef(onDataLoaded);
  React.useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : "Dokument-Metadaten konnten nicht geladen werden",
        );
      }
      const mapped = mapToDivaTextureDetail(json as unknown);
      setData(mapped);
      onDataLoadedRef.current?.(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId]);

  React.useEffect(() => {
    if (!translatedData) {
      void load();
    }
  }, [load, translatedData]);

  const displayData = translatedData || data;

  if (loading && !displayData) {
    return <div className="text-sm text-muted-foreground">{t("gallery.loading")}</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }
  if (!displayData) return null;

  return <DivaTextureDetail data={displayData} showBackLink={false} />;
}
