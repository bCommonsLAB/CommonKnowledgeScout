"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { EventSlides } from "@/components/event-slides";
import { EventSummary } from "@/components/event-summary";
import type { Slide } from "@/components/library/slide-accordion";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { useTranslation } from "@/lib/i18n/hooks";

/**
 * Interface für Session-Detail-Daten aus Event/Konferenz-Dokumenten
 */
export interface SessionDetailData {
  title: string;
  shortTitle?: string;
  teaser?: string;
  summary?: string; // Markdown-formatiert (für Retrieval)
  markdown?: string; // Markdown-Body für Detailansicht
  speakers?: string[];
  speakers_url?: string[];
  speakers_image_url?: string[];
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
  libraryId?: string; // Optional: für Link zur Library
}

/**
 * Detailansicht für Event-Sessions/Präsentationen
 * Moderne UI mit Hero-Section, Speakers mit Avataren, Event-Details Sidebar
 */
export function SessionDetail({ data, backHref = "/library", showBackLink = false, libraryId }: SessionDetailProps) {
  const { t } = useTranslation()
  const title = data.title || data.shortTitle || "—";
  const speakers = Array.isArray(data.speakers) ? data.speakers : [];
  const speakers_url = Array.isArray(data.speakers_url) ? data.speakers_url : [];
  const speakers_image_url = Array.isArray(data.speakers_image_url) ? data.speakers_image_url : [];
  const affiliations = Array.isArray(data.affiliations) ? data.affiliations : [];
  const slides = Array.isArray(data.slides) ? data.slides : [];

  // Helper: Speaker-URL für Index ermitteln
  const getSpeakerUrl = (index: number): string | undefined => {
    return speakers_url[index] && typeof speakers_url[index] === 'string' 
      ? speakers_url[index] 
      : undefined;
  };

  // Helper: Speaker-Image-URL für Index ermitteln
  const getSpeakerImageUrl = (index: number): string | undefined => {
    return speakers_image_url[index] && typeof speakers_image_url[index] === 'string' 
      ? speakers_image_url[index] 
      : undefined;
  };

  // Helper: Affiliation für Index ermitteln
  const getAffiliation = (index: number): string | undefined => {
    return affiliations[index] && typeof affiliations[index] === 'string' 
      ? affiliations[index] 
      : undefined;
  };

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden box-border">
      {/* Back Link */}
      {showBackLink && (
        <div className="w-full px-4 pt-4">
          <Link href={backHref} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{t('event.back')}</span>
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-b">
        <div className="w-full px-4 py-8">
          <div className="flex flex-col gap-8 items-start">
            {/* Left: Badge, Title, Teaser, and Speakers */}
            <div className="flex-1 w-full">
              <Badge className="mb-4 bg-blue-500 text-white hover:bg-blue-600">{t('event.talk')}</Badge>

              <h1 className="text-4xl lg:text-5xl font-bold mb-4 text-balance">{title}</h1>

              {data.teaser && (
                <p className="text-lg text-muted-foreground mb-6 text-pretty">{data.teaser}</p>
              )}

              {/* PDF-Link prominent anzeigen */}
              {data.url && (
                <div className="mb-6">
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-base font-medium shadow-sm"
                  >
                    <FileText className="w-5 h-5" />
                    PDF öffnen
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Speakers Section */}
              {speakers.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-4">
                  {speakers.map((speaker, index) => {
                    const speakerUrl = getSpeakerUrl(index);
                    const speakerImageUrl = getSpeakerImageUrl(index);
                    const affiliation = getAffiliation(index);
                    const speakerInitials = speaker
                      .split(" ")
                      .map((n) => n[0])
                      .join("");

                    const speakerContent = (
                      <Card className="p-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16 border-2 border-blue-400">
                            {speakerImageUrl ? (
                              <AvatarImage src={speakerImageUrl} alt={speaker} />
                            ) : null}
                            <AvatarFallback>{speakerInitials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                              {speaker}
                            </div>
                            {affiliation && (
                              <div className="text-sm text-muted-foreground">{affiliation}</div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );

                    if (speakerUrl) {
                      return (
                        <a
                          key={`${speaker}-${index}`}
                          href={speakerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                        >
                          {speakerContent}
                        </a>
                      );
                    }

                    return (
                      <div key={`${speaker}-${index}`} className="group">
                        {speakerContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-full px-4 py-8 box-border overflow-x-hidden">
        <div className="space-y-8 w-full max-w-full">
          {/* Markdown Content Section - full width (verwendet markdown Feld, fallback auf summary) */}
          {(data.markdown || data.summary) && (
            <>
              <EventSummary summary={data.markdown || data.summary || ''} videoUrl={data.video_url} />
              {/* KI-Info-Hinweis für KI-generierte Zusammenfassung */}
              <AIGeneratedNotice compact />
            </>
          )}

          {/* Slides Section - full width */}
          {slides.length > 0 && <EventSlides slides={slides} libraryId={libraryId} />}
        </div>
      </div>

      {/* Debug-Informationen am Ende */}
      {data.fileId && (
        <div className="w-full px-4 pb-8">
          <div className="text-[10px] text-muted-foreground/50 text-center pt-4 border-t break-words space-y-1">
            {data.fileName && (
              <div className="break-all">
                <FileText className="h-3 w-3 inline mr-1" />
                {data.fileName}
              </div>
            )}
            <div className="break-all">
              {t('event.fileId')}: <code className="px-0.5 py-0 bg-muted rounded text-[10px] break-all">{data.fileId}</code>
              {libraryId && (
                <Link 
                  href={`/library?activeLibraryId=${encodeURIComponent(libraryId)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    // Custom Event dispatchen, um Dokument in Gallery zu öffnen
                    const event = new CustomEvent('open-document-detail', {
                      detail: { fileId: data.fileId, fileName: data.fileName, libraryId },
                    });
                    window.dispatchEvent(event);
                    // Navigiere zur Library
                    window.location.href = `/library?activeLibraryId=${encodeURIComponent(libraryId)}`;
                  }}
                  className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('event.openInLibrary')}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionDetail;

