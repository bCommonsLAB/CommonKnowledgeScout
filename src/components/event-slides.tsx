"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { Slide } from "@/components/library/slide-accordion";
import { useTranslation } from "@/lib/i18n/hooks";

interface EventSlidesProps {
  slides: Slide[];
  libraryId?: string; // Optional: für Auflösung relativer Bildpfade
}

/**
 * Konvertiert einen relativen Pfad (bezogen auf Library-Root) zu einer Storage-API-URL
 * Der relative Pfad wird base64-kodiert und als fileId verwendet
 * 
 * @param relativePath Relativer Pfad wie "2024 SFSCON/assets/ansible/preview_001.jpg"
 * @param libraryId Die Library-ID
 * @returns Storage-API-URL oder undefined falls libraryId fehlt
 */
function resolveImageUrl(relativePath: string | undefined, libraryId: string | undefined): string | undefined {
  if (!relativePath || !libraryId) {
    return relativePath; // Fallback: ursprüngliche URL verwenden
  }

  // Prüfe ob es bereits eine absolute URL ist (http/https)
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // Normalisiere den Pfad (entferne führende/trailing Slashes)
  const normalizedPath = relativePath.replace(/^\/+|\/+$/g, '');

  // Prüfe auf Path-Traversal-Versuche
  if (normalizedPath.includes('..')) {
    console.warn('[EventSlides] Path traversal detected, ignoring:', normalizedPath);
    return relativePath; // Fallback: ursprüngliche URL verwenden
  }

  // Konvertiere relativen Pfad zu base64-kodierter fileId
  // (entspricht der Logik in getIdFromPath aus filesystem/route.ts)
  // Browser-kompatible base64-Kodierung für UTF-8-Strings
  try {
    // Konvertiere UTF-8-String zu Uint8Array und dann zu base64
    const utf8Bytes = new TextEncoder().encode(normalizedPath);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const fileId = btoa(binary);
    
    // Baue Storage-API-URL
    return `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(fileId)}&libraryId=${encodeURIComponent(libraryId)}`;
  } catch (error) {
    console.error('[EventSlides] Fehler beim Konvertieren des Bildpfads:', error);
    return relativePath; // Fallback: ursprüngliche URL verwenden
  }
}

/**
 * Komponente zur Anzeige von Präsentationsfolien
 * Zeigt Slides mit Thumbnails, Titel und Zusammenfassung
 */
export function EventSlides({ slides, libraryId }: EventSlidesProps) {
  const { t } = useTranslation()
  
  if (!slides || slides.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden box-border">
      <h2 className="text-2xl font-bold mb-6">{t('event.presentationSlides')}</h2>
      <div className="space-y-8 w-full max-w-full overflow-x-hidden box-border">
        {slides.map((slide) => {
          // Resolve relative image paths to Storage API URLs
          const imageUrl = resolveImageUrl(slide.image_url, libraryId);
          
          return (
            <div key={slide.page_num} className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start w-full max-w-full box-border">
              <div className="flex-shrink-0 w-full sm:w-64 max-w-full box-border">
                <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden w-full max-w-full">
                  {imageUrl ? (
                    // Verwende Storage-API-URL für relative Pfade oder next/image für externe URLs
                    <Image
                      src={imageUrl}
                      alt={slide.title || `Slide ${slide.page_num}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 256px"
                      onError={(e) => {
                        // Fallback bei fehlerhaftem Bild
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {t('event.noImage')}
                    </div>
                  )}
                  <Badge className="absolute top-2 left-2 bg-black/70 text-white text-xs">
                    {slide.page_num}
                  </Badge>
                </div>
              </div>
              <div className="flex-1 pt-1 w-full max-w-full min-w-0">
                {slide.title && (
                  <h3 className="text-lg font-semibold mb-2 text-balance">{slide.title}</h3>
                )}
                {slide.summary && (
                  <p className="text-muted-foreground text-pretty leading-relaxed">{slide.summary}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

