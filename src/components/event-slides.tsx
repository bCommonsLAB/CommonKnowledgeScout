import { Badge } from "@/components/ui/badge";

interface Slide {
  page_num: number;
  title: string;
  summary: string;
  image_url: string;
}

interface EventSlidesProps {
  slides: Slide[];
}

/**
 * Komponente zur Anzeige von Präsentationsfolien
 * Zeigt Slides mit Thumbnails, Titel und Zusammenfassung
 */
export function EventSlides({ slides }: EventSlidesProps) {
  if (!slides || slides.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Presentation Slides</h2>
      <div className="space-y-8">
        {slides.map((slide) => (
          <div key={slide.page_num} className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-64">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                {slide.image_url ? (
                  // Verwende normales img Tag für externe URLs (Next.js Image benötigt Domain-Konfiguration)
                  <img
                    src={slide.image_url}
                    alt={slide.title || `Slide ${slide.page_num}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback bei fehlerhaftem Bild
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Kein Bild
                  </div>
                )}
                <Badge className="absolute top-2 left-2 bg-black/70 text-white text-xs">
                  {slide.page_num}
                </Badge>
              </div>
            </div>
            <div className="flex-1 pt-1">
              {slide.title && (
                <h3 className="text-lg font-semibold mb-2 text-balance">{slide.title}</h3>
              )}
              <p className="text-muted-foreground text-pretty leading-relaxed">{slide.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

