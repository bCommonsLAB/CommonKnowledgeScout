'use client'

import { Button } from '@ks/ui'
import { Settings2, ChevronLeft, PanelLeft, BookOpen } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { PerspectiveDisplay } from '@/components/library/shared/perspective-display'
import { useActiveLibraryId } from '@ks/shell/react'

interface StoryHeaderProps {
  /** Wenn true, werden Border und Padding entfernt (für sticky Header) */
  compact?: boolean
  /** Callback für Zurück-zur-Gallery Button */
  onBackToGallery?: () => void
  /** Library-ID (optional, wird aus Atom verwendet falls nicht angegeben) */
  libraryId?: string
  /** D4: Menue-Knopf unter `lg`, oeffnet die Chronik als Sheet; ohne Rueckruf kein Knopf. */
  onOpenChronik?: () => void
  /** D12r: oeffnet auf dem Telefon die Quellen (Blatt); ab md steht die Leiste rechts. */
  onOpenQuellen?: () => void
}

/**
 * Header-Komponente für den Story-Modus.
 * 
 * Enthält:
 * - Button "Eigene Perspektive anpassen" und daneben die Perspektive als Plaketten (D9)
 * - Button "Zurück zur Gallery" (optional)
 */
export function StoryHeader({ compact = false, onBackToGallery, libraryId: libraryIdProp, onOpenChronik, onOpenQuellen }: StoryHeaderProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeLibraryId = useActiveLibraryId()
  const libraryId = libraryIdProp || activeLibraryId

  /**
   * Handler für "Perspektive anpassen" Button
   * Navigiert zur Perspective-Seite
   */
  function handleAdjustPerspective() {
    // Prüfe ob wir auf einer explore-Seite sind
    const isExplorePage = pathname?.startsWith('/explore/')
    if (isExplorePage) {
      // Extrahiere Slug aus pathname
      const slugMatch = pathname.match(/\/explore\/([^/]+)/)
      if (slugMatch && slugMatch[1]) {
        // Füge Query-Parameter hinzu, um zu signalisieren, dass wir vom Story Mode kommen
        router.push(`/explore/${slugMatch[1]}/perspective?from=story`)
        return
      }
    }
    
    // Für normale Library-Seiten: Navigiere zur Perspective-Seite mit libraryId
    if (libraryId) {
      // Erstelle URL mit allen aktuellen Query-Parametern (z.B. mode=story)
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.set('libraryId', libraryId)
      params.set('from', 'story')
      router.push(`/library/gallery/perspective?${params.toString()}`)
    }
  }

  return (
    <div className={`flex flex-col gap-2 flex-shrink-0 min-w-0 ${compact ? '' : 'pb-4 border-b'}`}>

      {/* Buttons: Zurück und Perspektive */}
      <div className="flex flex-wrap items-center gap-3 min-w-0 w-full">
        {/* D4: Chronik (Themen, Meine Fragen) mobil als Sheet — nur unter lg,
            auf dem Desktop steht sie als Spalte links. */}
        {onOpenChronik && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenChronik}
            className="flex items-center gap-2 shrink-0 lg:hidden"
            aria-label={t('story.chronik.open')}
          >
            <PanelLeft className="h-4 w-4" />
            <span className="whitespace-nowrap">{t('story.chronik.open')}</span>
          </Button>
        )}
        {/* D12r: Quellen auf dem Telefon als Blatt — ab md steht die Leiste rechts. */}
        {onOpenQuellen && (
          <Button variant="outline" size="sm" onClick={onOpenQuellen} className="flex items-center gap-2 shrink-0 md:hidden" aria-label={t('gallery.sources')}>
            <BookOpen className="h-4 w-4" />
            <span className="whitespace-nowrap">{t('gallery.sources')}</span>
          </Button>
        )}
        {/* Zurück-Button - vor Perspektive-Button */}
        {onBackToGallery && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToGallery}
            className="flex items-center gap-2 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="whitespace-nowrap">{t('gallery.backToGallery')}</span>
          </Button>
        )}

        {/* Perspektive-Button - navigiert zur Perspective-Seite */}
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 shrink-0"
          onClick={handleAdjustPerspective}
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{t('gallery.storyMode.perspective.adjustPerspective')}</span>
        </Button>
        {/* D9: Perspektive als Plaketten, Klick fuehrt wie der Knopf zur Perspektive-Seite */}
        <PerspectiveDisplay variant="header" onClick={handleAdjustPerspective} />
      </div>
    </div>
  )
}

