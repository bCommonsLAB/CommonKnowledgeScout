'use client'

import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Settings2 } from 'lucide-react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useUser } from '@clerk/nextjs'

// Props für zukünftige Erweiterungen
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface StoryHeaderProps {
  // Keine Props mehr nötig - Interface für zukünftige Erweiterungen
}

/**
 * Header-Komponente für den Story-Modus.
 * 
 * Enthält:
 * - Button "Eigene Perspektive anpassen" mit Popover für drei Dropdowns
 */
export function StoryHeader({}: StoryHeaderProps) {
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
    <div className="flex items-center pb-4 border-b flex-shrink-0">
      {/* Perspektive-Button */}
      <Popover open={perspectiveOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Settings2 className="h-4 w-4" />
            Eigene Perspektive anpassen
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Perspektive anpassen</h4>
              <p className="text-xs text-muted-foreground">
                Passe die Sprache, den Charakter und den sozialen Kontext der Antworten an.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              {/* Sprache */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Sprache</label>
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
                <label className="text-xs font-medium text-muted-foreground">Charakter</label>
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
                <label className="text-xs font-medium text-muted-foreground">Sozialer Kontext</label>
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
  )
}

