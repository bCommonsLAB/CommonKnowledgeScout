"use client";

import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export interface Chapter {
  order: number;
  level: number;
  title: string;
  startPage?: number;
  endPage?: number;
  summary?: string;
  keywords?: string[];
}

interface ChapterAccordionProps {
  chapters: Chapter[];
}

export function ChapterAccordion({ chapters }: ChapterAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {chapters.map((chapter, index) => (
        <AccordionItem key={index} value={`chapter-${index}`}>
          <AccordionTrigger className="text-left hover:no-underline py-3">
            <div className="flex items-baseline justify-between w-full gap-4" style={{ paddingLeft: `${Math.max(0, (chapter.level || 1) - 1) * 1.25}rem` }}>
              <div className="flex items-baseline gap-3 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{String(chapter.order).padStart(2, '0')}</span>
                <h3 className="text-sm font-medium text-foreground text-balance">{chapter.title}</h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono flex-shrink-0 pr-4">{chapter.startPage ?? '—'}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pr-4 pt-2" style={{ paddingLeft: `${Math.max(0, (chapter.level || 1) - 1) * 1.25 + 2.25}rem` }}>
              {chapter.summary ? (
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{chapter.summary}</p>
              ) : null}
              {Array.isArray(chapter.keywords) && chapter.keywords.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Schlüsselwörter:</p>
                  <div className="flex flex-wrap gap-1">
                    {chapter.keywords.slice(0, 8).map((k) => (
                      <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export default ChapterAccordion;


