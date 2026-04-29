"use client";

import * as React from "react";
import { RefurbedDeviceDetail, type RefurbedDeviceDetailData } from "./refurbed-device-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToRefurbedDeviceDetail } from "@/lib/mappers/doc-meta-mappers";
import { localizeDocMetaJson } from "@/lib/i18n/get-localized";

interface IngestionRefurbedDeviceDetailProps {
  libraryId: string;
  fileId: string;
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string;
}

/**
 * Wrapper fuer RefurbedDeviceDetail (gebrauchte PCs/Notebooks).
 *
 * Veredelt die geladene `docMetaJson` mit der globalen UI-Locale via
 * `localizeDocMetaJson`, bevor das Detail-Mapping erfolgt.
 *
 * Strukturell identisch zu IngestionDivaDocumentDetail - dasselbe Lade-Pattern.
 */
export function IngestionRefurbedDeviceDetail({
  libraryId,
  fileId,
  fallbackLocale,
}: IngestionRefurbedDeviceDetailProps) {
  const { t, locale } = useTranslation();
  const [data, setData] = React.useState<RefurbedDeviceDetailData | null>(null);
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
            : "Geräte-Metadaten konnten nicht geladen werden"
        );
      }
      const localized = localizeDocMetaJson(json?.docMetaJson as Record<string, unknown> | undefined, locale, fallbackLocale)
      const mapped = mapToRefurbedDeviceDetail({ ...json, docMetaJson: localized });
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

  return <RefurbedDeviceDetail data={data} showBackLink={false} />;
}

export default IngestionRefurbedDeviceDetail;
