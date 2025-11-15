'use client'

import { Button } from '@/components/ui/button'
import { Settings2, ChevronLeft } from 'lucide-react'
import { useStoryContext } from '@/hooks/use-story-context'
import { useTranslation } from '@/lib/i18n/hooks'
import { useRouter, usePathname } from 'next/navigation'

interface StoryHeaderProps {
  /** Wenn true, werden Border und Padding entfernt (für sticky Header) */
  compact?: boolean
  /** Callback für Zurück-zur-Gallery Button */
  onBackToGallery?: () => void
}

/**
 * Header-Komponente für den Story-Modus.
 * 
 * Enthält:
 * - Button "Eigene Perspektive anpassen" mit Popover für drei Dropdowns
 * - Button "Zurück zur Gallery" (optional)
 */
export function StoryHeader({ compact = false, onBackToGallery }: StoryHeaderProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  
  const {
    targetLanguage,
    character,
    accessPerspective,
    socialContext,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
  } = useStoryContext()

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
    // Für normale Library-Seiten können wir später eine Route hinzufügen
    // Aktuell nur für explore-Seiten implementiert
  }

  return (
    <div className={`flex flex-col gap-2 flex-shrink-0 min-w-0 ${compact ? '' : 'pb-4 border-b'}`}>
      {/* Aktuelle Perspektive - dezent angezeigt */}
      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 min-w-0 w-full">
      <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.title')}</span>
      <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.language')}: {targetLanguageLabels[targetLanguage]}</span>
        <span className="break-words min-w-0 flex-shrink">
          {t('gallery.storyMode.perspective.character')}: {character.map(char => characterLabels[char]).join(', ')}
        </span>
        {accessPerspective.length > 0 && (
          <span className="break-words min-w-0 flex-shrink">
            {t('gallery.storyMode.perspective.accessPerspective')}: {accessPerspective.map(ap => accessPerspectiveLabels[ap]).join(', ')}
          </span>
        )}
        <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.socialContext')}: {socialContextLabels[socialContext]}</span>
      </div>

      {/* Buttons: Zurück und Perspektive */}
      <div className="flex flex-wrap items-center gap-3 min-w-0 w-full">
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
      </div>
      
    </div>
  )
}

