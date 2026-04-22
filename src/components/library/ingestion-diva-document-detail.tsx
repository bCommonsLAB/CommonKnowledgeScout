"use client";

import * as React from "react";
import { DivaDocumentDetail, type DivaDocumentDetailData } from "./diva-document-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToDivaDocumentDetail } from "@/lib/mappers/doc-meta-mappers";
import { localizeDocMetaJson } from "@/lib/i18n/get-localized";

interface IngestionDivaDocumentDetailProps {
  libraryId: string;
  fileId: string;
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string;
}

/**
 * Wrapper fuer DivaDocumentDetail (Katalogdokumente).
 *
 * Veredelt die geladene `docMetaJson` mit der globalen UI-Locale via
 * `localizeDocMetaJson`, bevor das Detail-Mapping erfolgt.
 */
export function IngestionDivaDocumentDetail({
  libraryId,
  fileId,
  fallbackLocale,
}: IngestionDivaDocumentDetailProps) {
  const { t, locale } = useTranslation();
  const [data, setData] = React.useState<DivaDocumentDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: "no-store", headers: { 'x-locale': locale } });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : "Dokument-Metadaten konnten nicht geladen werden"
        );
      }
      const localized = localizeDocMetaJson(json?.docMetaJson as Record<string, unknown> | undefined, locale, fallbackLocale)
      const mapped = mapToDivaDocumentDetail({ ...json, docMetaJson: localized });
      setData(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId, locale, fallbackLocale]);

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

  return <DivaDocumentDetail data={data} showBackLink={false} />;
}

export default IngestionDivaDocumentDetail;
