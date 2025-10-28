"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Video, ExternalLink, Tag, Presentation, Building2 } from "lucide-react";
import Link from "next/link";
import { SlideAccordion, type Slide } from "./slide-accordion";
import { MarkdownPreview } from "./markdown-preview";
import { Button } from "@/components/ui/button";

/**
 * Interface für Session-Detail-Daten aus Event/Konferenz-Dokumenten
 */
export interface SessionDetailData {
  title: string;
  shortTitle?: string;
  teaser?: string;
  summary?: string; // Markdown-formatiert
  speakers?: string[];
  affiliations?: string[];
  tags?: string[];
  topics?: string[];
  year?: number | string;
  date?: string; // ISO-Date oder formatiert
  starttime?: string;
  endtime?: string;
  duration?: string | number;
  location?: string;
  event?: string;
  track?: string;
  session?: string;
  language?: string;
  slides?: Slide[];
  video_url?: string;
  attachments_url?: string;
  url?: string; // Session-URL auf Event-Website
  // Technische Felder
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

interface SessionDetailProps {
  data: SessionDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

/**
 * Detailansicht für Event-Sessions/Präsentationen
 * Zeigt Speaker, Affiliations, Event-Info, Zeiten, Slides mit Thumbnails
 */
export function SessionDetail({ data, backHref = "/library", showBackLink = false }: SessionDetailProps) {
  const title = data.title || data.shortTitle || "—";
  const speakers = Array.isArray(data.speakers) ? data.speakers : [];
  const affiliations = Array.isArray(data.affiliations) ? data.affiliations : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const topics = Array.isArray(data.topics) ? data.topics : [];
  const slides = Array.isArray(data.slides) ? data.slides : [];

  // Helper: Zeit-Range formatieren
  const getTimeRange = (): string | null => {
    if (data.starttime && data.endtime) {
      return `${data.starttime} - ${data.endtime}`;
    }
    if (data.starttime) {
      return `Ab ${data.starttime}`;
    }
    if (data.duration) {
      return `${data.duration} Min.`;
    }
    return null;
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {showBackLink ? (
        <Link href={backHref} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Zurück</span>
        </Link>
      ) : null}

      {/* Header */}
      <div className="mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-shrink-0 w-24 h-36 bg-secondary rounded border border-border flex items-center justify-center">
            <Presentation className="w-12 h-12 text-muted-foreground" />
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground mb-2 text-balance">{title}</h1>
            
            {/* Speakers */}
            {speakers.length > 0 ? (
              <div className="flex items-center gap-2 text-base text-muted-foreground mb-3">
                <Users className="w-4 h-4" />
                <p>{speakers.join(", ")}</p>
              </div>
            ) : null}

            {/* Badges: Jahr, Dauer, Sprache */}
            <div className="flex flex-wrap gap-2">
              {data.year !== undefined && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  {String(data.year)}
                </Badge>
              )}
              {getTimeRange() && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {getTimeRange()}
                </Badge>
              )}
              {data.language && (
                <Badge variant="outline" className="text-xs">
                  {String(data.language).toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Teaser (Kurzbeschreibung) */}
      {data.teaser && (
        <section className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
          <p className="text-sm text-foreground leading-relaxed text-pretty italic">
            {data.teaser}
          </p>
        </section>
      )}

      {/* Event-Info Sektion */}
      {(data.event || data.track || data.location || data.date) && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Event-Information
          </h2>
          <div className="space-y-2 text-sm">
            {data.event && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-20">Event:</span>
                <span className="font-medium">{data.event}</span>
              </div>
            )}
            {data.track && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-20">Track:</span>
                <span>{data.track}</span>
              </div>
            )}
            {data.date && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-20">Datum:</span>
                <span>{data.date}</span>
              </div>
            )}
            {data.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{data.location}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Summary (Markdown-formatiert) */}
      {data.summary && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
            Zusammenfassung
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MarkdownPreview content={data.summary} compact={true} />
          </div>
        </section>
      )}

      {/* Affiliations (Organisationen/Firmen der Speaker) */}
      {affiliations.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
            <Building2 className="w-3 h-3" />
            Organisationen
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {affiliations.map((aff, idx) => (
              <Badge key={`${aff}-${idx}`} variant="secondary" className="text-xs">
                {aff}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Tags & Topics kombiniert */}
      {(tags.length > 0 || topics.length > 0) && (
        <div className="grid grid-cols-1 gap-3 mb-6">
          {tags.length > 0 && (
            <section className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                <Tag className="w-3 h-3" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          )}
          {topics.length > 0 && (
            <section className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                <Tag className="w-3 h-3" />
                Themen
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Links: Video, Attachments, Session-URL */}
      {(data.video_url || data.attachments_url || data.url) && (
        <section className="bg-card border border-border rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
            Links
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.video_url && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={data.video_url} target="_blank" rel="noopener noreferrer">
                  <Video className="w-3 h-3 mr-2" />
                  Video ansehen
                </a>
              </Button>
            )}
            {data.attachments_url && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={data.attachments_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Anhänge
                </a>
              </Button>
            )}
            {data.url && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={data.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Session-Seite
                </a>
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Slides */}
      {slides.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
            <Presentation className="w-4 h-4" />
            Folien ({slides.length})
          </h2>
          <SlideAccordion slides={slides} />
        </section>
      )}

      {/* Fußzeile mit technischen Infos */}
      <div className="mt-6 text-xs text-muted-foreground border-t pt-2">
        <div className="flex flex-wrap gap-2">
          {data.fileName ? <span>Dateiname: {data.fileName}</span> : null}
          {typeof data.chunkCount === 'number' ? <span>Chunks: {data.chunkCount}</span> : null}
          {data.fileId ? <span>fileId: {data.fileId}</span> : null}
          {data.upsertedAt ? (
            <span>upsertedAt: {new Date(data.upsertedAt).toLocaleString('de-DE')}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SessionDetail;

