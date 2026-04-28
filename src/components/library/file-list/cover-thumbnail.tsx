'use client';

/**
 * file-list/cover-thumbnail.tsx
 *
 * Listen-Cover-Thumbnail mit lazy Aufloesung der Binary-URL ueber die
 * `/api/library/[libraryId]/shadow-twins/resolve-binary-url`-Route.
 *
 * Aus `file-list.tsx` extrahiert (Welle 3-I, Schritt 4b).
 *
 * Vertrag siehe `.cursor/rules/welle-3-schale-loader-contracts.mdc`:
 * - §2 Fehler-Semantik: Catch im Resolve-Pfad ist mit Begruendung
 *   versehen, weil das Thumbnail optional ist und ein Platzhalter
 *   gerendert wird.
 * - §3: Storage-Detail wird ausschliesslich ueber HTTP-API
 *   (`/api/.../resolve-binary-url`) gelesen — kein direkter Provider-Import.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ListCoverThumbnailProps {
  libraryId: string;
  sourceId: string;
  sourceName: string;
  parentId: string;
  coverImageUrl: string;
  className?: string;
}

export const ListCoverThumbnail = React.memo(function ListCoverThumbnail({
  libraryId,
  sourceId,
  sourceName,
  parentId,
  coverImageUrl,
  className,
}: ListCoverThumbnailProps) {
  const isAbsoluteUrl =
    coverImageUrl.startsWith('http://') ||
    coverImageUrl.startsWith('https://') ||
    coverImageUrl.startsWith('/api/');
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(
    isAbsoluteUrl ? coverImageUrl : null
  );

  React.useEffect(() => {
    if (isAbsoluteUrl || resolvedUrl !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/resolve-binary-url`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId, sourceName, parentId, fragmentName: coverImageUrl }),
          }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { resolvedUrl?: string };
        if (data?.resolvedUrl && !cancelled) setResolvedUrl(data.resolvedUrl);
      } catch {
        // Fehler still ignorieren (Thumbnail optional, Platzhalter wird gerendert).
        // Konform mit welle-3-schale-loader-contracts.mdc §2 (erlaubter
        // Optional-Pfad mit Begruendung im Kommentar).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryId, sourceId, sourceName, parentId, coverImageUrl, isAbsoluteUrl, resolvedUrl]);

  if (resolvedUrl) {
    // ESLint warnt vor <img>; ein <Image> wuerde aber Server-Resolution
    // brauchen. Cover-Thumbnail bewusst als <img>, weil URL erst zur
    // Laufzeit aufgeloest wird (Mongo-Pfad).
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={resolvedUrl}
        alt=""
        className={cn('h-6 w-6 rounded object-cover flex-shrink-0', className)}
        loading="lazy"
      />
    );
  }
  // Platzhalter waehrend des Ladens oder bei Fehler (vermeidet Layout-Sprung)
  return <div className={cn('h-6 w-6 rounded bg-muted flex-shrink-0 animate-pulse', className)} />;
});
