"use client";

/**
 * @fileoverview Die Buch-Detailansicht — seit M5 im Paket, weil das Embed Buecher zeigt.
 *
 * @description
 * Bis M5 lag sie in der App (`src/components/library/book-detail.tsx`) und
 * holte sich dort vier Dinge, die es in einer fremden Seite nicht gibt:
 * `next/image` fuer Cover und Anhang-Vorschauen, `next/link` fuer den
 * Zurueck-Link, die Archiv-Vorschau `MarkdownPreview` (mit Speicher-Kontext,
 * Clerk und `next/navigation` dahinter) und den KI-Hinweis mit `next/link`.
 * Diese vier kommen jetzt herein (`BookDetailProps`) — Pflicht bzw.
 * ausdruecklich `null`, kein stiller Rueckfall.
 *
 * Die App reicht ihre Varianten unter dem alten Pfad herein, ihr Verhalten
 * bleibt gleich. Das Embed nimmt `BuchDetailRenderer` (schlichtes `<img>`,
 * `MarkdownBody`, KI-Hinweis auf die Instanz). Datentypen und Mapper liegen
 * in `doc-meta/book-detail-mapper.ts`.
 */

import * as React from "react";
import type { ComponentType, ReactNode } from "react";
import { Badge } from '@ks/ui'
import { Calendar, FileText, MapPin, BookOpen, Tag, ExternalLink, Globe } from "lucide-react";
import type { BookDetailData } from "../../../doc-meta/book-detail-mapper";
import type { GalleryImageProps } from "../../contexts/gallery-host-context";
import { classifyReference } from "../../lib/reference-format";
import { ChapterAccordion } from "./chapter-accordion";
import { AttachmentList } from "./attachment-list";

/** Was die Ansicht ueber einen Markdown-Abschnitt sagt. */
export interface BookMarkdownProps {
  content: string;
  className?: string;
}

export interface BookDetailProps {
  data: BookDetailData;
  /** Womit Cover und Anhang-Vorschauen gerendert werden (App: `next/image`, Embed: `<img>`). */
  Bild: ComponentType<GalleryImageProps>;
  /** Womit Zusammenfassung und Inhalt gerendert werden (App: `MarkdownPreview`, Embed: `MarkdownBody`). */
  Markdown: ComponentType<BookMarkdownProps>;
  /** Hinweis auf KI-generierte Inhalte unter Zusammenfassung und Inhalt (EU AI Act Art. 50). */
  kiHinweis: ReactNode;
  /** Zurueck-Link ueber dem Titel; `null`, wenn der Montagepunkt keinen zeigt. */
  backLink: ReactNode;
}

export function BookDetail({ data, Bild, Markdown, kiHinweis, backLink }: BookDetailProps) {
  const title = data.title || "—";
  const authors = Array.isArray(data.authors) ? data.authors : [];

  // URL-Klassifikation: PDF oder Webseite → immer prominent als Button
  const urlIsPdf = data.url ? classifyReference(data.url) === 'pdf' : false

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {backLink}

      {/* Titel-/Kopfbereich: mit Cover klein links, sonst nur Titel + Badges */}
      <div className="mb-6">
        {data.coverImageUrl ? (
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-[136px] h-[204px] bg-secondary rounded border border-border overflow-hidden flex items-center justify-center">
              <Bild
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
              {/* Prominenter Quell-Button: "PDF öffnen" oder "Quelle öffnen" */}
              {data.url && (
                <div className="mb-3">
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    {urlIsPdf ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    {urlIsPdf ? 'PDF öffnen' : 'Quelle öffnen'}
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
            {data.url && (
              <div className="mb-3">
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  {urlIsPdf ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  {urlIsPdf ? 'PDF öffnen' : 'Quelle öffnen'}
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
        )}
      </div>

      {/* Zusammenfassung nur anzeigen, wenn kein Markdown-Body vorhanden ist —
           der Markdown-Body enthält den Summary bereits am Anfang. */}
      {data.summary && !data.markdown && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Zusammenfassung</h2>
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-muted-foreground">
            <Markdown content={normalizeEscapedNewlines(data.summary)} className="min-h-0 w-full" />
          </div>
          {kiHinweis}
        </section>
      )}

      {/* Verweise/Anhänge aus attachments_url, je Format gerendert (A4c) –
           nach Zusammenfassung, vor Metadaten. url hat oben einen eigenen Button. */}
      <AttachmentList references={data.attachments_url} title="Dokumente & Links" Bild={Bild} />

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
            <Markdown
              content={data.markdown}
              className="min-h-0 w-full"
            />
          </div>
          {/* KI-Info-Hinweis für KI-generierte Inhalte */}
          {kiHinweis}
        </section>
      )}

      {/* Debug-Modus: Detailansicht-Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 mb-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
          <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">🔍 Debug: BookDetail</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <div><strong>Detailansicht:</strong> BookDetail</div>
            <div><strong>docType:</strong> {data.docType || '—'}</div>
          </div>
        </div>
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

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Wandelt literal escaped Newlines (\\n) in echte Zeilenumbrüche um */
function normalizeEscapedNewlines(text: string): string {
  return text.replace(/\\n/g, '\n')
}
