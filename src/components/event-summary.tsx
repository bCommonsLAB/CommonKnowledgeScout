"use client";

import * as React from "react";
import { Card } from '@ks/ui'
import { MarkdownPreview } from "@/components/library/markdown-preview";
import type { StorageProvider } from "@/lib/storage/types";
import { isSafeVideoIframeSrc, isSafeAudioIframeSrc, isDirectAudioFileUrl } from "@/lib/media/safe-video-iframe";

interface EventSummaryProps {
  summary: string;
  videoUrl?: string;
  /** Audio-Embed (Funkwhale/open.audio) oder direkte Audio-Datei; wird unter Video/Cover als Player gezeigt. */
  audioUrl?: string;
  coverImageUrl?: string;
  provider?: StorageProvider | null;
  currentFolderId?: string;
}

/**
 * Komponente zur Anzeige der Event-Zusammenfassung
 * Zeigt Markdown-Inhalt mit zentralem MarkdownPreview-Viewer
 * Video ist bereits im Markdown integriert
 */
export function EventSummary({ summary, videoUrl, audioUrl, coverImageUrl, provider = null, currentFolderId = 'root' }: EventSummaryProps) {
  if (!summary) {
    return null;
  }

  // Nur echte Embed-URLs (YouTube/Vimeo/https-Video) — sonst relative Dateinamen → HTML-404 im iframe.
  const embeddableVideoUrl = videoUrl && isSafeVideoIframeSrc(videoUrl) ? videoUrl : undefined;
  // Audio: Embed-Player (iframe, niedrig) oder natives <audio> fuer direkte Dateien.
  const audioIframeSrc = audioUrl && isSafeAudioIframeSrc(audioUrl) ? audioUrl : undefined;
  const audioFileSrc = !audioIframeSrc && audioUrl && isDirectAudioFileUrl(audioUrl) ? audioUrl : undefined;

  return (
    <Card className="px-6 pt-0 pb-6 w-full max-w-full overflow-x-hidden box-border">
      {/* Markdown Content mit zentralem MarkdownPreview */}

      {/* Primär: eingebettbares Web-Video, Fallback: Coverbild (ungültige video_url ignorieren) */}
      {embeddableVideoUrl ? (
        <div className="mb-6 aspect-video rounded-lg overflow-hidden bg-muted w-full max-w-full box-border relative">
          {/* iframe mit loading="lazy" für verzögertes Laden (Performance in verschachtelten Ansichten) */}
          <iframe
            src={embeddableVideoUrl}
            className="absolute inset-0 w-full h-full max-w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            title="Event Video"
          />
        </div>
      ) : coverImageUrl ? (
        <div className="mb-6 rounded-lg overflow-hidden bg-muted w-full max-w-full box-border border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt="Coverbild"
            className="w-full h-auto max-h-[520px] object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      {audioIframeSrc ? (
        <div className="mb-6 rounded-lg overflow-hidden bg-muted w-full max-w-full box-border border">
          <iframe
            src={audioIframeSrc}
            className="w-full max-w-full"
            style={{ height: 120 }}
            allow="autoplay"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
            title="Audio"
          />
        </div>
      ) : audioFileSrc ? (
        <div className="mb-6 w-full max-w-full">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls preload="none" src={audioFileSrc} className="w-full" />
        </div>
      ) : null}
      <div className="prose prose-slate dark:prose-invert max-w-none w-full overflow-x-hidden">
        <MarkdownPreview 
          content={summary} 
          provider={provider}
          currentFolderId={currentFolderId}
          compact={true}
          className="min-h-0 w-full max-w-full"
        />
      </div>
    </Card>
  );
}

