"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, FileText, MapPin, BookOpen, Tag } from "lucide-react";
import Link from "next/link";
import { ChapterAccordion } from "./chapter-accordion";

export interface Chapter {
  order: number;
  level: number;
  title: string;
  startPage?: number;
  endPage?: number;
  summary?: string;
  keywords?: string[];
}

export interface BookDetailData {
  title: string;
  authors: string[];
  year: number | string;
  pages?: number;
  region?: string;
  summary?: string;
  source?: string;
  issue?: string | number;
  language?: string;
  docType?: string;
  commercialStatus?: string;
  topics?: string[];
  chapters?: Chapter[];
  chunkCount?: number;
  chaptersCount?: number;
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
}

interface BookDetailProps {
  data: BookDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

export function BookDetail({ data, backHref = "/library", showBackLink = false }: BookDetailProps) {
  const title = data.title || "—";
  const authors = Array.isArray(data.authors) ? data.authors : [];

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {showBackLink ? (
        <Link href={backHref} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Zurück</span>
        </Link>
      ) : null}

      <div className="mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-shrink-0 w-24 h-36 bg-secondary rounded border border-border flex items-center justify-center">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">{title}</h1>
            {authors.length > 0 ? (
              <p className="text-base text-muted-foreground mb-3">{authors.join(", ")}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {data.year !== undefined && (
                <Badge variant="outline" className="text-xs"><Calendar className="w-3 h-3 mr-1" />{String(data.year)}</Badge>
              )}
              {data.pages !== undefined && (
                <Badge variant="outline" className="text-xs"><FileText className="w-3 h-3 mr-1" />{String(data.pages)} Seiten</Badge>
              )}
              {data.region && (
                <Badge variant="outline" className="text-xs"><MapPin className="w-3 h-3 mr-1" />{data.region}</Badge>
              )}
              {data.docType && (
                <Badge variant="outline" className="text-xs">{String(data.docType)}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {data.summary && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Zusammenfassung</h2>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{data.summary}</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Metadaten</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.commercialStatus && (<span>Status: {data.commercialStatus}</span>)}
            {data.source && (<span>Quelle: {data.source}</span>)}
            {data.issue && (<span>Ausgabe: {String(data.issue)}</span>)}
            {data.language && (<span>Sprache: {String(data.language).toUpperCase()}</span>)}
            {data.docType && (<span>Typ: {data.docType}</span>)}
          </div>
        </section>
        {Array.isArray(data.topics) && data.topics.length > 0 && (
          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2"><Tag className="w-3 h-3" />Themen</h2>
            <div className="flex flex-wrap gap-1.5">
              {data.topics.map((t) => (<Badge key={t} variant="secondary" className="text-xs">{t}</Badge>))}
            </div>
          </section>
        )}
      </div>

      {Array.isArray(data.chapters) && data.chapters.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide flex items-center gap-2"><BookOpen className="w-4 h-4" />Kapitelübersicht ({data.chapters.length})</h2>
          <ChapterAccordion chapters={data.chapters} />
        </section>
      )}

      {/* Fußzeile mit technischen Infos */}
      <div className="mt-6 text-xs text-muted-foreground border-t pt-2">
        <div className="flex flex-wrap gap-1">
          {data.fileName ? <span>Dateiname: {data.fileName}</span> : null}
          {typeof data.chunkCount === 'number' ? <span>Chunks: {data.chunkCount}</span> : null}
          {typeof data.chaptersCount === 'number' ? <span>Kapitel: {data.chaptersCount}</span> : null}
          {data.fileId ? <span>fileId: {data.fileId}</span> : null}
          {data.upsertedAt ? <span>upsertedAt: {new Date(data.upsertedAt).toLocaleString('de-DE')}</span> : null}
        </div>
      </div>
    </div>
  )
}

export default BookDetail;


