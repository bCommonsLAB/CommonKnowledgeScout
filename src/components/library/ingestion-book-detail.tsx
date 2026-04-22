"use client";

import * as React from "react";
import { BookDetail, type BookDetailData } from "./book-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToBookDetail } from "@/lib/mappers/doc-meta-mappers";
import { localizeDocMetaJson } from "@/lib/i18n/get-localized";

interface IngestionBookDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
  /** Optional: Bereits vorgeladene Originaldaten (verhindert doppelten doc-meta-Request) */
  initialData?: BookDetailData;
  /** Optional: Verhindert initialen Auto-Fetch, bis Parent-Prefetch entschieden ist */
  suspendInitialFetch?: boolean;
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string;
}

/**
 * Lädt die Detail-Daten eines Buches aus dem doc-meta-Endpoint und veredelt
 * sie mit der globalen UI-Locale (`useTranslation().locale`):
 *
 *   - Sucht in `docMetaJson.translations.detail.<locale>` (Markdown, Summary, …)
 *   - faellt sonst auf `<fallbackLocale>` zurueck
 *   - faellt sonst auf das Originalfeld (`docMetaJson.<field>`) zurueck
 *
 * Das geschieht via `localizeDocMetaJson(...)` BEVOR der Mapper `mapToBookDetail`
 * greift; so bleiben Mapper sprachneutral.
 */
export function IngestionBookDetail({
  libraryId,
  fileId,
  initialData,
  suspendInitialFetch = false,
  fallbackLocale,
}: IngestionBookDetailProps) {
  const { t, locale } = useTranslation()
  const [data, setData] = React.useState<BookDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // x-locale Header sorgt server-seitig fuer locale-spezifische Projection
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store', headers: { 'x-locale': locale } });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Dokument-Metadaten konnten nicht geladen werden');
      // Locale-Veredelung VOR dem Detail-Mapping
      const localized = localizeDocMetaJson(json?.docMetaJson as Record<string, unknown> | undefined, locale, fallbackLocale)
      const mapped = mapToBookDetail({ ...json, docMetaJson: localized });
      setData(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId, locale, fallbackLocale]);

  React.useEffect(() => {
    if (suspendInitialFetch) return
    // Vorgeladene (bereits sprach-veredelte) Daten nutzen, doppelten doc-meta-Call vermeiden.
    if (initialData) {
      setData(initialData)
      setError(null)
      setLoading(false)
      return
    }
    void load()
  }, [load, initialData, suspendInitialFetch]);

  if (loading && !data) return <div className="text-sm text-muted-foreground">{t('gallery.loading')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return null;

  return <BookDetail data={data} showBackLink={false} />;
}


export default IngestionBookDetail;
