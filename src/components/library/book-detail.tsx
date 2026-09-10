"use client";

/**
 * @fileoverview Die Buch-Detailansicht der Voll-App.
 *
 * @description
 * Die Ansicht liegt seit M5 im Paket (`@ks/module-explorer/react`), weil das
 * Embed Buecher zeigen muss. Hier steckt nur, was die App anders macht als
 * eine fremde Seite:
 *
 * - Bilder ueber `next/image` (`NextBild`),
 * - Markdown ueber die Archiv-Vorschau `MarkdownPreview`, kompakt wie bisher,
 * - der KI-Hinweis mit `next/link` auf die eigene Route,
 * - der optionale Zurueck-Link (`showBackLink`, `backHref`).
 *
 * Archiv-Vorschau, Inbox, Wizard-Vorschau und Job-Report importieren weiter
 * von hier; ihr Verhalten bleibt gleich.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookDetail as PaketBookDetail, type BookMarkdownProps } from "@ks/module-explorer/react";
import type { BookDetailData } from "@ks/module-explorer";
import { NextBild } from "@/components/providers/next-bild";
import { AIGeneratedNotice } from "@/components/shared/ai-generated-notice";
import { MarkdownPreview } from "./markdown-preview";

export type { BookDetailData, Chapter } from "@ks/module-explorer";

/** Die Archiv-Vorschau, so kompakt wie vor M5 an beiden Stellen der Ansicht. */
function ArchivMarkdown({ content, className }: BookMarkdownProps) {
  return <MarkdownPreview content={content} compact className={className} />;
}

interface BookDetailProps {
  data: BookDetailData;
  backHref?: string;
  showBackLink?: boolean;
}

export function BookDetail({ data, backHref = "/library", showBackLink = false }: BookDetailProps) {
  return (
    <PaketBookDetail
      data={data}
      Bild={NextBild}
      Markdown={ArchivMarkdown}
      kiHinweis={<AIGeneratedNotice compact />}
      backLink={
        showBackLink ? (
          <Link href={backHref} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Zurück</span>
          </Link>
        ) : null
      }
    />
  );
}

export default BookDetail;
