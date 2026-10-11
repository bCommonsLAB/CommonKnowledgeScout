"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from '@ks/ui'
import type { Slide } from "@/components/library/slide-accordion";
import { useTranslation } from "@ks/i18n/react";

interface EventSlidesProps {
  slides: Slide[];
}

/**
 * Welle J2: Der Ingest liefert `slides[].image_url` als abrufbare Adresse
 * (Blob-URL aus den Twin-Fragmenten oder Site-absoluter Pfad). Ein nackter
 * Dateiname bedeutet: nicht aufgeloest. Frueher riet die Komponente daraus
 * einen Pfad relativ zur Library-Wurzel (HTTP 400); jetzt wird der Zustand
 * gezeigt, nicht geraten (no-silent-fallbacks).
 */
export function isDisplayableImageUrl(value: string | undefined): value is string {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function SlideImage({ slide }: { slide: Slide }) {
  const { t } = useTranslation()
  const [loadFailed, setLoadFailed] = useState(false)
  const imageUrl = slide.image_url

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        {t('event.noImage')}
      </div>
    )
  }
  if (!isDisplayableImageUrl(imageUrl)) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground"
        data-testid="slide-image-unresolved"
      >
        <span>{t('event.imageUnresolved')}</span>
        <span className="break-all">{imageUrl}</span>
      </div>
    )
  }
  if (loadFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center px-2 text-center text-xs text-muted-foreground" data-testid="slide-image-failed">
        {t('event.imageLoadFailed')}
      </div>
    )
  }
  return (
    <Image
      src={imageUrl}
      alt={slide.title || `Slide ${slide.page_num}`}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 100vw, 256px"
      onError={() => setLoadFailed(true)}
    />
  )
}

/**
 * Komponente zur Anzeige von Praesentationsfolien
 * Zeigt Slides mit Thumbnails, Titel und Zusammenfassung
 */
export function EventSlides({ slides }: EventSlidesProps) {
  const { t } = useTranslation()

  if (!slides || slides.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden box-border">
      <h2 className="text-2xl font-bold mb-6">{t('event.presentationSlides')}</h2>
      <div className="space-y-8 w-full max-w-full overflow-x-hidden box-border">
        {slides.map((slide) => (
          <div key={slide.page_num} className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start w-full max-w-full box-border">
            <div className="flex-shrink-0 w-full sm:w-64 max-w-full box-border">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden w-full max-w-full">
                <SlideImage slide={slide} />
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
        ))}
      </div>
    </div>
  );
}
