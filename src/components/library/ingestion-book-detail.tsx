"use client";

import * as React from "react";
import { BookDetail, type BookDetailData } from "./book-detail";
import { useTranslation } from "@/lib/i18n/hooks";
import { mapToBookDetail } from "@/lib/mappers/doc-meta-mappers";

interface IngestionBookDetailProps {
  libraryId: string;
  fileId: string;
  docModifiedAt?: string;
  translatedData?: BookDetailData;
  /** Optional: Bereits vorgeladene Originaldaten (verhindert doppelten doc-meta-Request) */
  initialData?: BookDetailData;
  /** Optional: Verhindert initialen Auto-Fetch, bis Parent-Prefetch entschieden ist */
  suspendInitialFetch?: boolean;
  /** Callback wenn Original-Daten geladen wurden (für Übersetzungs-Logik im Parent) */
  onDataLoaded?: (data: BookDetailData) => void;
}

export function IngestionBookDetail({
  libraryId,
  fileId,
  translatedData,
  initialData,
  suspendInitialFetch = false,
  onDataLoaded,
}: IngestionBookDetailProps) {
  const { t } = useTranslation()
  const [data, setData] = React.useState<BookDetailData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Verwende den schnellen doc-meta Endpunkt (MongoDB)
      // docModifiedAt wird ignoriert, da doc-meta nur MongoDB-Daten liefert
      const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Dokument-Metadaten konnten nicht geladen werden');
      const mapped = mapToBookDetail(json as unknown);
      setData(mapped);
      onDataLoaded?.(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId]);

  React.useEffect(() => {
    if (suspendInitialFetch) return

    // Übersetzte Daten werden direkt verwendet, kein Original-Fetch nötig.
    if (translatedData) return

    // Vorgenladene Originaldaten nutzen, um doppelten doc-meta-Call zu vermeiden.
    if (initialData) {
      setData(initialData)
      setError(null)
      setLoading(false)
      onDataLoaded?.(initialData)
      return
    }

    void load()
  }, [load, translatedData, initialData, onDataLoaded, suspendInitialFetch]);

  // Verwende übersetzte Daten, falls vorhanden
  const displayData = translatedData || data;

  if (loading && !displayData) return <div className="text-sm text-muted-foreground">{t('gallery.loading')}</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!displayData) return null;

  return <BookDetail data={displayData} showBackLink={false} />;
}


export default IngestionBookDetail;


