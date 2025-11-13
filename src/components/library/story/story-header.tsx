'use client'

import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Settings2, ChevronLeft } from 'lucide-react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useUser } from '@clerk/nextjs'
import { useTranslation } from '@/lib/i18n/hooks'

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
  const [perspectiveOpen, setPerspectiveOpen] = useAtom(storyPerspectiveOpenAtom)
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  
  const {
    targetLanguage,
    setTargetLanguage,
    character,
    setCharacter,
    socialContext,
    setSocialContext,
    targetLanguageLabels,
    characterLabels,
    socialContextLabels,
  } = useStoryContext()

  // Beim Schließen des Popovers: Speichere Werte im localStorage
  function handleOpenChange(open: boolean) {
    setPerspectiveOpen(open)
    
    // Wenn Popover geschlossen wird: Speichere Werte
    if (!open && isAnonymous) {
      saveStoryContextToLocalStorage(targetLanguage, character, socialContext, isAnonymous)
    }
  }

  return (
    <div className={`flex flex-col gap-2 flex-shrink-0 min-w-0 ${compact ? '' : 'pb-4 border-b'}`}>
      {/* Aktuelle Perspektive - dezent angezeigt */}
      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 min-w-0 w-full">
        <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.language')}: {targetLanguageLabels[targetLanguage]}</span>
        <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.character')}: {characterLabels[character]}</span>
        <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.socialContext')}: {socialContextLabels[socialContext]}</span>
      </div>
      {/* Help-Text - über den Buttons */}
      <div className="text-sm text-muted-foreground break-words min-w-0 w-full mb-4">
        <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.adjustPerspectiveHelpText')}</span>
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

        {/* Perspektive-Button */}
        <Popover open={perspectiveOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{t('gallery.storyMode.perspective.adjustPerspective')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t('gallery.storyMode.perspective.adjustPerspectiveTitle')}</h4>
                <p className="text-xs text-muted-foreground">
                  {t('gallery.storyMode.perspective.adjustPerspectiveDescription')}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                {/* Sprache */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('gallery.storyMode.perspective.language')}</label>
                  <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as typeof targetLanguage)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(targetLanguageLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Charakter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('gallery.storyMode.perspective.character')}</label>
                  <Select value={character} onValueChange={(v) => setCharacter(v as typeof character)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(characterLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sozialer Kontext */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('gallery.storyMode.perspective.socialContext')}</label>
                  <Select value={socialContext} onValueChange={(v) => setSocialContext(v as typeof socialContext)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(socialContextLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
    </div>
  )
}

