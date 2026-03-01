"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, FileText, MapPin, BookOpen, Tag, ExternalLink, Globe, Paperclip } from "lucide-react";
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
  /** Autoren-Bilder, Index-basiert gemappt auf authors[] */
  authors_image_url?: string[];
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
  /** Generische URL: kann PDF-URL oder Web-Link sein */
  url?: string;
  /** Anhänge (Dokumente, PDFs, etc.) */
  attachments_url?: string[];
}

interface BookDetailProps {
  data: BookDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

export function BookDetail({ data, backHref = "/library", showBackLink = false }: BookDetailProps) {
  const title = data.title || "—";
  const authors = Array.isArray(data.authors) ? data.authors : [];

  // URL-Klassifikation: PDF oder Webseite → immer prominent als Button
  const urlIsPdf = data.url ? isPdfUrl(data.url) : false
  // Attachments in Dokumente vs. Links aufteilen (url NICHT enthalten, da eigener Button)
  const attachmentGroups = classifyAttachments(data.attachments_url)

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

      {data.summary && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Zusammenfassung</h2>
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-muted-foreground">
            <MarkdownPreview content={normalizeEscapedNewlines(data.summary)} compact className="min-h-0 w-full" />
          </div>
          <AIGeneratedNotice compact />
        </section>
      )}

      {/* Dokumente & Links aus attachments_url – nach Zusammenfassung, vor Metadaten */}
      {(attachmentGroups.documents.length > 0 || attachmentGroups.links.length > 0) && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          {/* Dokumente (PDF-Anhänge) */}
          {attachmentGroups.documents.length > 0 && (
            <div className={attachmentGroups.links.length > 0 ? 'mb-4' : ''}>
              <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Dokumente
              </h2>
              <ul className="space-y-1.5">
                {attachmentGroups.documents.map((url, idx) => (
                  <li key={idx}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{extractDisplayName(url)}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Web-Links aus Attachments */}
          {attachmentGroups.links.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Links
              </h2>
              <ul className="space-y-1.5">
                {attachmentGroups.links.map((url, idx) => (
                  <li key={idx}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{extractDisplayName(url)}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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

/** Erkennt PDF-URLs anhand Dateiendung oder Azure Blob Storage Muster */
function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    // Explizite .pdf-Endung
    if (pathname.endsWith('.pdf')) return true
    // Azure Blob Storage mit PDF-Dateinamen (URL-encoded Leerzeichen möglich)
    if (pathname.includes('.pdf')) return true
  } catch {
    // Relative URL oder ungültig
    if (url.toLowerCase().endsWith('.pdf')) return true
  }
  return false
}

/**
 * Klassifiziert attachments_url in Dokumente (PDFs) und Web-Links.
 * data.url wird hier NICHT berücksichtigt (hat eigenen prominenten Button).
 */
function classifyAttachments(
  attachmentsUrl: string[] | undefined
): { documents: string[]; links: string[] } {
  const documents: string[] = []
  const links: string[] = []

  if (attachmentsUrl) {
    for (const u of attachmentsUrl) {
      if (isPdfUrl(u)) {
        documents.push(u)
      } else {
        links.push(u)
      }
    }
  }

  return { documents, links }
}

/** Wandelt literal escaped Newlines (\\n) in echte Zeilenumbrüche um */
function normalizeEscapedNewlines(text: string): string {
  return text.replace(/\\n/g, '\n')
}

/** Extrahiert einen lesbaren Anzeigenamen aus einer URL */
function extractDisplayName(url: string): string {
  try {
    const parsed = new URL(url)
    // Für Blob-Storage: Dateiname aus Pfad
    const segments = parsed.pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment)
    }
    // Für Webseiten: Hostname + Pfad
    const path = parsed.pathname.length > 1 ? parsed.pathname : ''
    return `${parsed.hostname}${path}`
  } catch {
    return url
  }
}