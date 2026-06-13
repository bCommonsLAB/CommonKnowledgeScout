"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * src/components/library/gallery/provenance-text.tsx
 *
 * Generelle Provenienz-Kennzeichnung von Inhalten:
 * - `AiText`        : KI-/redaktionell formulierter Text → BLAU. Auf einen Blick
 *                     erkennbar, was die KI formuliert hat.
 * - `OriginalQuote` : transkribierter Originaltext (aus der Quelle) → neutral/grau,
 *                     hinter einem Symbol als Popover (spart Platz).
 *
 * Gerendert wird reines Markdown ueber `react-markdown` (nur Text + Links, KEINE
 * Editor-/Toolbar-Chrome). Markdown-Syntax (z.B. Links) wird aufgeloest.
 */

const REMARK = [remarkGfm];

/** Links immer in neuem Tab, sicher. */
const LINK_COMPONENT = {
  a: (props: React.ComponentPropsWithoutRef<"a">) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
};

/** KI-/redaktionell formulierter Text (blau). */
export function AiText({
  content,
  className,
}: {
  content: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed",
        "[&_p]:text-blue-800 [&_li]:text-blue-800 [&_strong]:text-blue-900 [&_a]:text-blue-700",
        "dark:[&_p]:text-blue-300 dark:[&_li]:text-blue-300 dark:[&_strong]:text-blue-200 dark:[&_a]:text-blue-300",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={REMARK} components={LINK_COMPONENT}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Transkribierter Originaltext (neutral) hinter einem Symbol als Popover. */
export function OriginalQuote({
  content,
  label = "Originaltext",
}: {
  content: string;
  label?: string;
}): React.JSX.Element {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Quote className="h-3 w-3 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[70] max-h-96 w-[32rem] max-w-[92vw] overflow-auto"
      >
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Originaltext (Quelle)
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none break-words text-muted-foreground prose-a:text-foreground">
          <ReactMarkdown remarkPlugins={REMARK} components={LINK_COMPONENT}>
            {content}
          </ReactMarkdown>
        </div>
      </PopoverContent>
    </Popover>
  );
}
