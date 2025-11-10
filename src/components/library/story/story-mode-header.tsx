'use client'

import { useEffect, useState } from 'react'
import { StoryHeader } from './story-header'
import { useTranslation } from '@/lib/i18n/hooks'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

interface StoryModeHeaderProps {
  libraryId: string
  onBackToGallery?: () => void
}

interface StoryConfig {
  headline?: string
  intro?: string
}

/**
 * Header-Bereich für den Story-Modus.
 * 
 * Zeigt Titel, Beschreibung und Action-Buttons oben im Story-Tab.
 * Lädt die Texte aus der Config.
 */
export function StoryModeHeader({ libraryId, onBackToGallery }: StoryModeHeaderProps) {
  const { t } = useTranslation()
  const [storyConfig, setStoryConfig] = useState<StoryConfig | null>(null)

  // Lade Story-Config aus der API
  useEffect(() => {
    let cancelled = false
    async function loadStoryConfig() {
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Fehler beim Laden der Config: ${res.statusText}`)
        const apiData = await res.json() as { publicPublishing?: { story?: StoryConfig } }
        if (!cancelled && apiData.publicPublishing?.story) {
          setStoryConfig(apiData.publicPublishing.story)
        }
      } catch (e) {
        console.error('[StoryModeHeader] Fehler beim Laden der Config:', e)
      }
    }
    loadStoryConfig()
    return () => { cancelled = true }
  }, [libraryId])

  // Defaults für Texte (falls nicht in Config vorhanden)
  const headline = storyConfig?.headline || t('story.defaultHeadline')
  const intro = storyConfig?.intro || t('story.defaultIntro')

  return (
    <div className="space-y-4 mb-6 flex-shrink-0">
      {/* Titel und Beschreibung */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{headline}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{intro}</p>
      </div>

      {/* Buttons: Perspektive links, Zurück rechts */}
      <div className="flex items-center justify-between gap-3">
        <StoryHeader />
        {/* Zurück-Button im Story-Modus - rechtsbündig */}
        {onBackToGallery && (
          <Button
            variant='outline'
            size='sm'
            onClick={onBackToGallery}
            className='flex items-center gap-2 flex-shrink-0 ml-auto'
          >
            <ChevronLeft className='h-4 w-4' />
            {t('gallery.backToGallery')}
          </Button>
        )}
      </div>
    </div>
  )
}

