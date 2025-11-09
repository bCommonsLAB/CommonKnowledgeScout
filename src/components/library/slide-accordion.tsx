"use client";

import * as React from "react";
import Image from "next/image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Presentation } from "lucide-react";
import { MarkdownPreview } from "@/components/library/markdown-preview";

/**
 * Interface für Slide-Daten aus Session-Dokumenten
 */
export interface Slide {
  page_num: number;
  title: string;
  summary?: string;
  image_url?: string;
}

interface SlideAccordionProps {
  slides: Slide[];
  /** Optional: Basis-URL für relative Bild-Pfade */
  baseUrl?: string;
}

/**
 * Accordion-Komponente zur Anzeige von Session-Slides mit Thumbnails
 * Ähnlich wie ChapterAccordion, aber optimiert für Präsentationsfolien
 */
export function SlideAccordion({ slides, baseUrl = '' }: SlideAccordionProps) {
  // Helper: Vollständige Bild-URL konstruieren
  const getImageUrl = (imageUrl: string | undefined): string | undefined => {
    if (!imageUrl) return undefined;
    // Falls bereits absolute URL, direkt zurückgeben
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    // Andernfalls relativ zu baseUrl konstruieren
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}/${imageUrl.replace(/^\//, '')}` : imageUrl;
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      {slides.map((slide, index) => {
        const fullImageUrl = getImageUrl(slide.image_url);
        
        return (
          <AccordionItem key={slide.page_num || index} value={`slide-${slide.page_num || index}`}>
            <AccordionTrigger className="text-left hover:no-underline py-3">
              <div className="flex items-center justify-between w-full gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Presentation className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                    {String(slide.page_num).padStart(2, '0')}
                  </span>
                  <h3 className="text-sm font-medium text-foreground text-balance line-clamp-1">
                    {slide.title || `Folie ${slide.page_num}`}
                  </h3>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent>
              <div className="pl-11 pr-4 pt-2 space-y-3">
                {/* Thumbnail-Vorschau falls verfügbar */}
                {fullImageUrl && (
                  <div className="relative w-full aspect-video bg-muted rounded border border-border overflow-hidden">
                    <Image
                      src={fullImageUrl}
                      alt={`Vorschau Folie ${slide.page_num}: ${slide.title}`}
                      fill
                      className="object-contain"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback bei Ladefehler: Icon anzeigen
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center text-muted-foreground">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                              </svg>
                            </div>
                          `;
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Summary als Markdown gerendert falls vorhanden */}
                {slide.summary ? (
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {/* Prüfen ob Markdown-Formatierung vorhanden ist (z.B. ## oder **) */}
                    {slide.summary.includes('##') || slide.summary.includes('**') || slide.summary.includes('*') ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownPreview 
                          content={slide.summary} 
                          compact={true}
                        />
                      </div>
                    ) : (
                      <p className="text-pretty">{slide.summary}</p>
                    )}
                  </div>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export default SlideAccordion;

