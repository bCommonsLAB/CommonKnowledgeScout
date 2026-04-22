"use client";

import * as React from "react";
import { SessionDetail, type SessionDetailData } from "./session-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToSessionDetail } from "@/lib/mappers/doc-meta-mappers";
import { localizeDocMetaJson } from "@/lib/i18n/get-localized";

interface IngestionSessionDetailProps {
  libraryId: string;
  fileId: string;
  /** Optional: Bereits vorgeladene Originaldaten (verhindert doppelten doc-meta-Request) */
  initialData?: SessionDetailData;
  /** Optional: Verhindert initialen Auto-Fetch, bis Parent-Prefetch entschieden ist */
  suspendInitialFetch?: boolean;
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string;
}

/**
 * Wrapper-Komponente fuer SessionDetail.
 *
 * Laedt Session-Daten ueber den `doc-meta`-Endpoint und veredelt sie
 * vor dem Mapping mit der globalen UI-Locale (siehe `localizeDocMetaJson`).
 * Faellt sauber auf `fallbackLocale` und schliesslich die Originalsprache
 * zurueck, wenn keine Uebersetzung vorhanden ist.
 */
export function IngestionSessionDetail({
  libraryId,
  fileId,
  initialData,
  suspendInitialFetch = false,
  fallbackLocale,
}: IngestionSessionDetailProps) {
  const { t, locale } = useTranslation()
  const [data, setData] = React.useState<SessionDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store', headers: { 'x-locale': locale } });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : t('event.errorLoadingSessionData'));
      const localized = localizeDocMetaJson(json?.docMetaJson as Record<string, unknown> | undefined, locale, fallbackLocale)
      const mapped = mapToSessionDetail({ ...json, docMetaJson: localized });
      setData(mapped);
    } catch (e) {
      console.error('[IngestionSessionDetail] Error:', e);
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId, locale, fallbackLocale, t]);

  React.useEffect(() => {
    if (suspendInitialFetch) return
    if (initialData) {
      setData(initialData)
      setError(null)
      setLoading(false)
      return
    }
    void load()
  }, [load, initialData, suspendInitialFetch]);

  if (loading && !data) return <div className="text-sm text-muted-foreground">{t('event.loadingSessionData')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return null;

  return <SessionDetail data={data} showBackLink={false} libraryId={libraryId} />;
}


export default IngestionSessionDetail;
