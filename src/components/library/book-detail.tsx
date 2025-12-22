"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, FileText, MapPin, BookOpen, Tag, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ChapterAccordion } from "./chapter-accordion";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { MarkdownPreview } from "./markdown-preview";

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
  markdown?: string;
  coverImageUrl?: string;
  url?: string; // PDF-URL aus Azure Storage
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

      {/* Titel-/Kopfbereich: mit Cover klein links, sonst nur Titel + Badges */}
      <div className="mb-6">
        {data.coverImageUrl ? (
          <div className="flex gap-4 items-start">
            {/* Kleines Cover-Bild (Preview) links neben dem Titel */}
            <div className="flex-shrink-0 w-[136px] h-[204px] bg-secondary rounded border border-border overflow-hidden flex items-center justify-center">
              <Image
                src={data.coverImageUrl}
                alt={title}
                width={136}
                height={204}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>

              <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">{title}</h1>
              {authors.length > 0 ? (
                <p className="text-base text-muted-foreground mb-3">{authors.join(", ")}</p>
              ) : null}
              {/* PDF-Link prominent anzeigen */}
              {data.url && (
                <div className="mb-3">
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    PDF öffnen
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
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
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">{title}</h1>
            {/* PDF-Link prominent anzeigen (auch ohne Cover) */}
            {data.url && (
              <div className="mb-3">
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  PDF öffnen
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {/* Ohne Cover kein Autoren-Teaser, nur Badges */}
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
        )}
      </div>

      {data.summary && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Zusammenfassung</h2>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{data.summary}</p>
          {/* KI-Info-Hinweis für KI-generierte Zusammenfassung */}
          <AIGeneratedNotice compact />
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

      {/* Kapitelübersicht VOR Markdown-Body */}
      {Array.isArray(data.chapters) && data.chapters.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide flex items-center gap-2"><BookOpen className="w-4 h-4" />Kapitelübersicht ({data.chapters.length})</h2>
          <ChapterAccordion chapters={data.chapters} />
        </section>
      )}

      {/* Markdown-Body (Inhalt) */}
      {data.markdown && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Inhalt</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <MarkdownPreview 
              content={data.markdown} 
              compact={true}
              className="min-h-0 w-full"
            />
          </div>
          {/* KI-Info-Hinweis für KI-generierte Inhalte */}
          <AIGeneratedNotice compact />
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


