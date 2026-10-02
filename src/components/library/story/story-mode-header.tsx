'use client'

import { useMemo } from 'react'
import { StoryHeader } from './story-header'
import { useScrollVisibility } from '@/hooks/use-scroll-visibility'
import { useStoryHinweis } from '@/hooks/use-story-hinweis'
import { useLibraries } from '@ks/shell/react'

interface StoryModeHeaderProps {
  libraryId: string
  onBackToGallery?: () => void
  /** D4: oeffnet mobil die Chronik (Sheet); ohne Rueckruf kein Knopf. */
  onOpenChronik?: () => void
}

/**
 * Kopf der Seite im Story-Modus (D10, Figma „6 · Kopf der Seite").
 *
 * Traegt den INHALT: Titel und Zweizeiler der Library aus `publicPublishing`
 * (`publicName`/`description`, sonst das Label). Die Erklaerung des
 * Story-Modus steht nicht mehr hier, sondern als einmaliger Hinweis in der
 * Mitte (`useStoryHinweis`); der Knopf „?" im `StoryHeader` holt ihn zurueck.
 *
 * Verhalten wie bisher: Beim Scrollen blenden Titel und Zweizeiler aus, die
 * Knoepfe bleiben (gleiche Scroll-Logik wie TopNav und GalleryStickyHeader).
 */
export function StoryModeHeader({ libraryId, onBackToGallery, onOpenChronik }: StoryModeHeaderProps) {
  const libraries = useLibraries()
  const { zeigen } = useStoryHinweis()

  const kopf = useMemo(() => {
    const library = libraries.find((lib) => lib.id === libraryId)
    const pub = library?.config?.publicPublishing
    return {
      titel: pub?.publicName || library?.label || '',
      zweizeiler: pub?.description || undefined,
    }
  }, [libraries, libraryId])

  // isVisible === false bedeutet: Titelbereich ausblenden (condensed)
  const isVisible = useScrollVisibility()
  const isCondensed = !isVisible

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
      {/* Titel und Zweizeiler der Library - werden beim Scrollen ausgeblendet */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isCondensed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-96 opacity-100'
        }`}
        style={{
          willChange: isCondensed ? 'max-height, opacity' : 'auto',
          // Verhindere Layout-Shifts während Transition (robuster für ältere Geräte)
          contain: 'layout style paint',
        }}
      >
        <div className="py-4 space-y-1" data-story-seitenkopf>
          {kopf.titel && <h2 className="text-2xl font-bold leading-tight">{kopf.titel}</h2>}
          {kopf.zweizeiler && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground max-w-3xl">{kopf.zweizeiler}</p>}
        </div>
      </div>

      {/* Buttons: StoryHeader nutzt die ganze Breite; „?" holt den Hinweis zurueck */}
      <div className="py-2 w-full">
        <StoryHeader compact onBackToGallery={onBackToGallery} onOpenChronik={onOpenChronik} onHilfe={zeigen} libraryId={libraryId} />
      </div>
    </div>
  )
}
