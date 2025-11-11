'use client'

import { useEffect, useState } from 'react'
import { StoryHeader } from './story-header'
import { useTranslation } from '@/lib/i18n/hooks'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { useScrollVisibility } from '@/hooks/use-scroll-visibility'

interface StoryModeHeaderProps {
  libraryId: string
  onBackToGallery?: () => void
}

interface StoryConfig {
  headline?: string
  subtitle?: string
  intro?: string
}

/**
 * Header-Bereich für den Story-Modus.
 * 
 * Zeigt Titel, Beschreibung und Action-Buttons oben im Story-Tab.
 * Lädt die Texte aus der Config.
 * 
 * Verhalten:
 * - Blendet beim Scrollen Titel/Untertitel/Erklärung aus (wie GalleryStickyHeader)
 * - Lässt die Buttons sichtbar
 * - Verwendet die gleiche Scroll-Visibility-Logik wie TopNav und GalleryStickyHeader
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

  // Verwende gemeinsamen Scroll-Visibility-Hook (wie TopNav und GalleryStickyHeader)
  // isVisible === false bedeutet: Header-Bereich ausblenden (condensed)
  const isVisible = useScrollVisibility()
  const isCondensed = !isVisible

  // Verwende Texte aus der Config, falls vorhanden, sonst Fallback aus Übersetzungen
  const headline = storyConfig?.headline || t('gallery.storyMode.headline')
  const subtitle = storyConfig?.subtitle || t('gallery.storyMode.subtitle')
  const intro = storyConfig?.intro || t('gallery.storyMode.description')

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
      {/* Titel und Beschreibung - werden beim Scrollen ausgeblendet */}
      <div className={`transition-all duration-300 overflow-hidden ${isCondensed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'}`}>
        <div className="py-4 space-y-2">
          <h2 className="text-3xl font-bold">{headline}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground font-medium">{subtitle}</p> : null}
          {intro ? (
            <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{intro}</p>
          ) : null}
        </div>
      </div>

      {/* Buttons: Perspektive links, Zurück rechts - bleiben immer sichtbar */}
      <div className="py-2 flex items-center justify-between gap-3">
        <StoryHeader compact />
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

