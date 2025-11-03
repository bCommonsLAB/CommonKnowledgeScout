"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { MarkdownPreview } from "@/components/library/markdown-preview";

interface EventSummaryProps {
  summary: string;
  videoUrl?: string; 
}

/**
 * Komponente zur Anzeige der Event-Zusammenfassung
 * Zeigt Markdown-Inhalt mit zentralem MarkdownPreview-Viewer
 * Video ist bereits im Markdown integriert
 */
export function EventSummary({ summary, videoUrl }: EventSummaryProps) {
  if (!summary) {
    return null;
  }

  return (
    <Card className="px-6 pt-0 pb-6 w-full max-w-full overflow-x-hidden">
      {/* Markdown Content mit zentralem MarkdownPreview */}

      {/* Video Embed */}
      {videoUrl && (
        <div className="mb-6 aspect-video rounded-lg overflow-hidden bg-muted">
          <iframe
            src={videoUrl}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Event Video"
          />
        </div>
      )}
      <div className="prose prose-slate dark:prose-invert max-w-none w-full overflow-x-hidden">
        <MarkdownPreview 
          content={summary} 
          compact={true}
          className="min-h-0 w-full max-w-full"
        />
      </div>
    </Card>
  );
}

