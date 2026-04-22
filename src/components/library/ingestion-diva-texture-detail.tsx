"use client";

import * as React from "react";
import { DivaTextureDetail, type DivaTextureDetailData } from "./diva-texture-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToDivaTextureDetail } from "@/lib/mappers/doc-meta-mappers";

interface IngestionDivaTextureDetailProps {
  libraryId: string;
  fileId: string;
}

/**
 * Laedt doc-meta fuer publizierte Textur-Analysen und rendert {@link DivaTextureDetail}.
 *
 * divaTexture hat KEINEN Translation-Pfad (PBR-/Material-Daten sind sprachneutral),
 * daher kein `localizeDocMetaJson`-Aufruf hier.
 */
export function IngestionDivaTextureDetail({
  libraryId,
  fileId,
}: IngestionDivaTextureDetailProps) {
  const { t } = useTranslation();
  const [data, setData] = React.useState<DivaTextureDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <div className="text-sm text-muted-foreground">{t("gallery.loading")}</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }
  if (!data) return null;

  return <DivaTextureDetail data={data} showBackLink={false} />;
}
