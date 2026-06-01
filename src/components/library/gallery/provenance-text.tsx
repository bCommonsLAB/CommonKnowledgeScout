"use client";

import * as React from "react";
import { Sparkles, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownPreview } from "../markdown-preview";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * src/components/library/gallery/provenance-text.tsx
 *
 * Generelle Provenienz-Kennzeichnung von Inhalten:
 * - `AiText`   : KI-generierter/redaktioneller Text → BLAU eingefaerbt + dezentes
 *                KI-Symbol. So ist auf einen Blick erkennbar, was die KI formuliert hat.
 * - `OriginalQuote`: transkribierter Originaltext (aus der Quelle) → neutral/grau,
 *                hinter einem Symbol als Popover (spart Platz auf der Seite).
 *
 * Beide rendern Markdown ueber `MarkdownPreview` (Links etc. bleiben erhalten).
 */

/** KI-/redaktionell formulierter Text (blau). */
export function AiText({
  content,
  className,
}: {
  content: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("text-sm", className)}>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_p]:text-blue-800 [&_li]:text-blue-800 [&_strong]:text-blue-900",
          "dark:[&_p]:text-blue-300 dark:[&_li]:text-blue-300 dark:[&_strong]:text-blue-200",
        )}
      >
        <MarkdownPreview content={content} compact={true} className="min-h-0 w-full" />
      </div>
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
        className="z-[70] max-h-80 w-80 max-w-[90vw] overflow-auto"
      >
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Originaltext (Quelle)
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
          <MarkdownPreview content={content} compact={true} className="min-h-0 w-full" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Kleines KI-Symbol (optional zur Kennzeichnung von KI-Abschnitten). */
export function AiBadge({ className }: { className?: string }): React.JSX.Element {
  return (
    <Sparkles
      className={cn("h-3 w-3 text-blue-600 dark:text-blue-400", className)}
      aria-label="KI-generiert"
    />
  );
}
