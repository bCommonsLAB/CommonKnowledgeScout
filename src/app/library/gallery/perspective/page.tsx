'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowRight, Globe, Compass, Eye, Users, Sparkles, ArrowLeft } from 'lucide-react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { useTranslation } from '@/lib/i18n/hooks'
import type { Character, SocialContext, TargetLanguage, AccessPerspective } from '@/lib/chat/constants'
import { CHARACTER_VALUES, ACCESS_PERSPECTIVE_VALUES, TARGET_LANGUAGE_VALUES } from '@/lib/chat/constants'
import { useAtomValue } from 'jotai'
import { librariesAtom } from '@/atoms/library-atom'
import { useUser } from '@clerk/nextjs'

/**
 * Perspektivenauswahl-Seite für Story Mode (normale Library-Seiten)
 * 
 * Normale Seite (nicht Modal) für bessere UX bei langen Inhalten.
 * Route: /library/gallery/perspective?libraryId=...
 */
interface Library {
  id: string
  label: string
}

export default function LibraryPerspectivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const libraries = useAtomValue(librariesAtom)
  const libraryId = searchParams?.get('libraryId')
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  
  // Lade Library-Daten für Header
  const [library, setLibrary] = useState<Library | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(true)
  
  useEffect(() => {
    if (!libraryId) {
      setLibraryLoading(false)
      return
    }
    
    // Finde Library aus Atom
    const foundLibrary = libraries.find(lib => lib.id === libraryId)
    if (foundLibrary) {
      setLibrary({
        id: foundLibrary.id,
        label: foundLibrary.label,
      })
    }
    setLibraryLoading(false)
  }, [libraryId, libraries])
  
  const {
    targetLanguage,
    setTargetLanguage,
    character,
    setCharacter,
    accessPerspective,
    setAccessPerspective,
    socialContext,
    setSocialContext,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
  } = useStoryContext()

  // Lokaler State für die Formularwerte (werden erst beim Speichern übernommen)
  const [localLanguage, setLocalLanguage] = useState<TargetLanguage>(targetLanguage)
  const [localInterests, setLocalInterests] = useState<Character[]>(character)
  const [localAccessPerspective, setLocalAccessPerspective] = useState<AccessPerspective[]>(accessPerspective)
  const [localLanguageStyle, setLocalLanguageStyle] = useState<SocialContext>(socialContext)

  // Synchronisiere lokale Werte mit globalen Werten beim Laden
  useEffect(() => {
    setLocalLanguage(targetLanguage)
    setLocalInterests(character)
    setLocalAccessPerspective(accessPerspective)
    setLocalLanguageStyle(socialContext)
  }, [targetLanguage, character, accessPerspective, socialContext])

  // Handler für Speichern
  function handleSave() {
    setTargetLanguage(localLanguage)
    setCharacter(localInterests)
    setAccessPerspective(localAccessPerspective)
    setSocialContext(localLanguageStyle)
    
    // Speichere in localStorage für persistente Einstellungen
    saveStoryContextToLocalStorage(
      localLanguage,
      localInterests,
      localLanguageStyle,
      localAccessPerspective,
      isAnonymous
    )
    
    // Navigiere zurück zur Gallery (Story Mode)
    const params = new URLSearchParams()
    if (libraryId) params.set('libraryId', libraryId)
    params.set('mode', 'story')
    router.push(`/library/gallery?${params.toString()}`)
  }

  // Handler für Modus-Wechsel
  function handleModeChange(value: string) {
    const params = new URLSearchParams()
    if (libraryId) params.set('libraryId', libraryId)
    params.set('mode', value)
    router.push(`/library/gallery?${params.toString()}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header mit integrierten Tabs - gleiche Struktur wie Hauptseite */}
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex items-start justify-between gap-2 sm:gap-4 px-3 py-2 sm:py-4">
          {/* Linker Bereich: Zurück-Button + Titel als Logo/Label */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Prominenter Zurück-Button zur Gallery */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 sm:w-10 hover:bg-muted/50"
              onClick={() => {
                const params = new URLSearchParams()
                if (libraryId) params.set('libraryId', libraryId)
                params.set('mode', 'story')
                router.push(`/library/gallery?${params.toString()}`)
              }}
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            {/* Titel als Logo/Label */}
            {!libraryLoading && library && (
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {t('gallery.storyMode.perspective.adjustPerspective')}
                </p>
              </div>
            )}
          </div>
          {/* Tabs rechts oben in der Ecke (auch auf mobil) */}
          <div className="flex-shrink-0 self-start pt-0.5">
            <Tabs value="story" onValueChange={handleModeChange} className="w-auto">
              <TabsList className="h-8 sm:h-10">
                <TabsTrigger value="gallery" className="text-xs sm:text-sm px-2 sm:px-3">{t('gallery.gallery')}</TabsTrigger>
                <TabsTrigger value="story" className="text-xs sm:text-sm px-2 sm:px-3">{t('gallery.story')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Intro-Text */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{t('gallery.storyMode.perspective.adjustPerspective')}</h2>
            <p className="text-muted-foreground">{t('gallery.storyMode.perspective.adjustPerspectiveDescription')}</p>
          </div>

          {/* Formular-Felder */}
          <div className="space-y-6">
            {/* Zielsprache */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <label className="text-sm font-medium">{t('gallery.storyMode.perspective.targetLanguage')}</label>
                  </div>
                  <Select value={localLanguage} onValueChange={(value) => setLocalLanguage(value as TargetLanguage)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_LANGUAGE_VALUES.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {targetLanguageLabels[lang]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Interessenprofil */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Compass className="h-5 w-5 text-muted-foreground" />
                    <label className="text-sm font-medium">{t('gallery.storyMode.perspective.character')}</label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('gallery.storyMode.perspective.characterDescription')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHARACTER_VALUES.map((char) => {
                      const isSelected = localInterests.includes(char)
                      return (
                        <Badge
                          key={char}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            if (isSelected) {
                              setLocalInterests(localInterests.filter(c => c !== char))
                            } else if (localInterests.length < 3) {
                              setLocalInterests([...localInterests, char])
                            }
                          }}
                        >
                          {characterLabels[char]}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('gallery.storyMode.perspective.characterHint')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Zugangsperspektive */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <label className="text-sm font-medium">{t('gallery.storyMode.perspective.accessPerspective')}</label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('gallery.storyMode.perspective.accessPerspectiveDescription')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACCESS_PERSPECTIVE_VALUES.map((perspective) => {
                      const isSelected = localAccessPerspective.includes(perspective)
                      return (
                        <Badge
                          key={perspective}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            if (isSelected) {
                              setLocalAccessPerspective(localAccessPerspective.filter(p => p !== perspective))
                            } else if (localAccessPerspective.length < 3) {
                              setLocalAccessPerspective([...localAccessPerspective, perspective])
                            }
                          }}
                        >
                          {accessPerspectiveLabels[perspective]}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('gallery.storyMode.perspective.accessPerspectiveHint')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Sprachstil */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    <label className="text-sm font-medium">{t('gallery.storyMode.perspective.socialContext')}</label>
                  </div>
                  <Select value={localLanguageStyle} onValueChange={(value) => setLocalLanguageStyle(value as SocialContext)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['general', 'academic', 'professional', 'casual'].map((ctx) => (
                        <SelectItem key={ctx} value={ctx}>
                          {socialContextLabels[ctx as SocialContext]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Speichern-Button */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              const params = new URLSearchParams()
              if (libraryId) params.set('libraryId', libraryId)
              params.set('mode', 'story')
              router.push(`/library/gallery?${params.toString()}`)
            }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <span>{t('common.save')}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

