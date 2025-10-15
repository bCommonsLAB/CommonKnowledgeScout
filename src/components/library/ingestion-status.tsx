"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChapterRow {
  order?: number;
  chapterId: string;
  title?: string;
  startChunk?: number;
  endChunk?: number;
  chunkCount?: number;
  startPage?: number;
  endPage?: number;
  summary?: string;
  keywords?: string[];
  upsertedAt?: string;
}

interface IngestionStatusData {
  indexExists: boolean;
  doc: {
    exists: boolean;
    status: "ok" | "stale" | "not_indexed";
    fileName?: string;
    title?: string;
    user?: string;
    chunkCount?: number;
    chaptersCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
  };
  chapters: ChapterRow[];
}

export function IngestionStatus({ libraryId, fileId, docModifiedAt }: { libraryId: string; fileId: string; docModifiedAt?: string }) {
  const [data, setData] = React.useState<IngestionStatusData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/ingestion-status?fileId=${encodeURIComponent(fileId)}${docModifiedAt ? `&docModifiedAt=${encodeURIComponent(docModifiedAt)}` : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Ingestion-Status konnte nicht geladen werden');
      setData(json as IngestionStatusData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [libraryId, fileId, docModifiedAt]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <div className="text-sm text-muted-foreground">Lade Ingestion-Status…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return null;

  const statusClass = data.doc.status === 'ok' ? 'bg-green-100 text-green-700'
    : data.doc.status === 'stale' ? 'bg-amber-100 text-amber-800'
    : 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Index {data.indexExists ? 'vorhanden' : 'nicht vorhanden'}</Badge>
          <Badge variant="secondary">Doc {data.doc.exists ? 'vorhanden' : 'nicht vorhanden'}</Badge>
          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${statusClass}`}>{data.doc.status}</span>
        </div>
        <button className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs" onClick={() => void load()}>Aktualisieren</button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="space-y-1">
          <div className="font-medium">Dokument</div>
          <div className="text-xs text-muted-foreground truncate">Titel: {data.doc.title || data.doc.fileName || '—'}</div>
          <div className="text-xs text-muted-foreground">Nutzer: {data.doc.user || '—'}</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium">Statistik</div>
          <div className="text-xs text-muted-foreground">Chunks: {data.doc.chunkCount ?? '—'} · Kapitel: {data.doc.chaptersCount ?? '—'}</div>
          <div className="text-xs text-muted-foreground">Upserted: {data.doc.upsertedAt ?? '—'}</div>
        </div>
      </div>

      <div className="mt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Kapitel</TableHead>
              <TableHead className="w-24">Chunks</TableHead>
              <TableHead className="w-24">Start</TableHead>
              <TableHead className="w-24">Ende</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.chapters.map((c, i) => (
              <TableRow key={c.chapterId}>
                <TableCell className="align-top">
                  <span className="text-xs">{typeof c.order === 'number' ? c.order : (i + 1)}</span>
                </TableCell>
                <TableCell className="align-top">
                  <Collapsible>
                    <CollapsibleTrigger className="text-left w-full">
                      <div className="truncate text-sm">{c.title || c.chapterId}</div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {c.summary ? <div className="whitespace-pre-wrap break-words">{c.summary}</div> : null}
                        {Array.isArray(c.keywords) && c.keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">{c.keywords.slice(0, 12).map(k => <Badge key={k} variant="outline">{k}</Badge>)}</div>
                        ) : null}
                        <div>Upserted: {c.upsertedAt ?? '—'} · Chunks: {c.chunkCount ?? '—'}</div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </TableCell>
                <TableCell className="align-top">{c.chunkCount ?? '—'}</TableCell>
                <TableCell className="align-top">{c.startPage ?? c.startChunk ?? '—'}</TableCell>
                <TableCell className="align-top">{c.endPage ?? c.endChunk ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default IngestionStatus;


