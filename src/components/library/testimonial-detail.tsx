"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, User } from "lucide-react";
import Link from "next/link";
import { MarkdownPreview } from "@/components/library/markdown-preview";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { useTranslation } from "@/lib/i18n/hooks";

/**
 * Interface für Testimonial-Detail-Daten
 */
export interface TestimonialDetailData {
  title?: string;
  teaser?: string;
  markdown?: string; // Markdown-Body für Detailansicht
  // Fragen/Antworten
  q1_experience?: string;
  q2_key_insight?: string;
  q3_why_important?: string;
  // Autor-Informationen
  author_name?: string;
  author_role?: string;
  author_nickname?: string;
  author_is_named?: boolean;
  author_image_url?: string;
  // Technische Felder
  fileId?: string;
  fileName?: string;
  upsertedAt?: string;
  chunkCount?: number;
}

interface TestimonialDetailProps {
  data: TestimonialDetailData;
  backHref?: string;
  showBackLink?: boolean;
  libraryId?: string; // Optional: für Link zur Library
}

/**
 * Detailansicht für Testimonials
 * Zeigt Fragen/Antworten, Autor-Informationen und optionales Bild
 */
export function TestimonialDetail({ data, backHref = "/library", showBackLink = false, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  libraryId: _unused_libraryId }: TestimonialDetailProps) {
  const { t } = useTranslation()
  const title = data.title || "Testimonial";
  const teaser = data.teaser;
  const markdown = data.markdown || "";
  
  // Autor-Informationen
  // Zeige author_name, wenn vorhanden, sonst author_nickname
  const authorName = data.author_name || data.author_nickname || undefined;
  const authorRole = data.author_role;
  const authorImageUrl = data.author_image_url;
  
  // Debug: Log für Entwicklung (kann später entfernt werden)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[TestimonialDetail] Author data:', {
      author_name: data.author_name,
      author_nickname: data.author_nickname,
      author_is_named: data.author_is_named,
      authorName,
      authorRole,
      authorImageUrl,
    });
  }

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
      <div className="w-full px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <Badge className="mb-4 bg-blue-500 text-white hover:bg-blue-600">
            TESTIMONIAL
          </Badge>

          {/* Autor-Header: Rundes Bild mit Name und Rolle daneben (zuerst) */}
          {(authorImageUrl || authorName || authorRole) && (
            <div className="flex items-center gap-4 mb-6">
              {/* Rundes Avatar-Bild */}
              {authorImageUrl ? (
                <Avatar className="w-20 h-20 md:w-24 md:h-24 flex-shrink-0">
                  <AvatarImage src={authorImageUrl} alt={authorName || "Autor"} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    <User className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground" />
                </div>
              )}

              {/* Name und Rolle */}
              <div className="flex-1 min-w-0">
                {authorName && (
                  <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-1">
                    {authorName}
                  </h2>
                )}
                {authorRole && (
                  <p className="text-base text-muted-foreground">
                    {authorRole}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Titel (unterhalb Bild/Name/Rolle) */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {title}
          </h1>

          {/* Teaser (unterhalb Titel) */}
          {teaser && (
            <p className="text-lg text-muted-foreground mb-8">
              {teaser}
            </p>
          )}
        </div>
      </div>

      {/* Content Section: Fragen und Antworten aus Markdown */}
      {markdown && markdown.trim().length > 0 && (
        <div className="w-full px-4 pb-12">
          <div className="max-w-4xl mx-auto">
            <Card className="p-6">
              <MarkdownPreview
                content={markdown}
                currentFolderId="root"
              />
            </Card>
          </div>
        </div>
      )}

      {/* AI Generated Notice */}
      <AIGeneratedNotice />
    </div>
  );
}

