'use client'

/**
 * Header-Bereich der Perspektiv-Seite.
 *
 * Enthaelt:
 * - Sticky-Navigation-Header mit Zurueck-Button und Tabs (Gallery/Story)
 * - Page-Header mit Titel und Untertitel
 * - Info-Banner ("Warum diese Seite?")
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Sparkles, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'

interface PerspectiveHeaderProps {
  library: { id: string; label: string } | null
  libraryLoading: boolean
  fromStoryMode?: boolean
  onBack: () => void
  onModeChange: (mode: 'gallery' | 'story') => void
}

/**
 * Sticky-Navigation-Header + Page-Header + Info-Banner fuer die Perspektiv-Seite.
 */
export function PerspectiveHeader({
  library,
  libraryLoading,
  fromStoryMode,
  onBack,
  onModeChange,
}: PerspectiveHeaderProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Sticky-Navigation-Header mit Tabs */}
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex items-start justify-between gap-2 sm:gap-4 px-3 py-2 sm:py-4">
          {/* Linker Bereich: Zurueck-Button + Library-Titel */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-muted/50"
              onClick={onBack}
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            {!libraryLoading && library && (
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {t('gallery.storyMode.perspective.adjustPerspective')}
                </p>
              </div>
            )}
          </div>
          {/* Tabs rechts oben */}
          <div className="flex-shrink-0 self-start pt-0.5">
            <Tabs value="story" onValueChange={(value) => onModeChange(value as 'gallery' | 'story')} className="w-auto">
              <TabsList className="h-8 sm:h-10">
                <TabsTrigger value="gallery" className="text-xs sm:text-sm px-2 sm:px-3">{t('gallery.gallery')}</TabsTrigger>
                <TabsTrigger value="story" className="text-xs sm:text-sm px-2 sm:px-3">{t('gallery.story')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Page-Header mit Titel, Untertitel und Zurueck-Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {fromStoryMode
              ? t('gallery.backToStoryMode')
              : t('gallery.backToGallery')
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('chat.perspectivePage.title')}
        </h1>
        <p className="text-base text-muted-foreground">
          {t('chat.perspectivePage.subtitle')}
        </p>
      </div>

      <Separator className="my-6" />

      {/* Info-Banner: Warum diese Seite? */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-medium text-sm">
                {t('chat.perspectivePage.whyThisPageTitle')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('chat.perspectivePage.whyThisPageText')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
