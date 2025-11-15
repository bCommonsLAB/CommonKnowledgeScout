'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowRight, Globe, Target, Users, Sparkles, ArrowLeft, X } from 'lucide-react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { useUser } from '@clerk/nextjs'
import { useTranslation } from '@/lib/i18n/hooks'
import type { Character, SocialContext, TargetLanguage } from '@/lib/chat/constants'
import { CHARACTER_VALUES } from '@/lib/chat/constants'
import Link from 'next/link'

/**
 * Perspektivenauswahl-Seite für Story Mode
 * 
 * Normale Seite (nicht Modal) für bessere UX bei langen Inhalten.
 * Route: /explore/[slug]/perspective
 */
interface PublicLibrary {
  id: string
  label: string
  slugName: string
  description?: string
}

export default function PerspectivePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  const slug = params?.slug as string
  
  // Prüfe, ob die Seite vom Story Mode aufgerufen wurde (via Query-Parameter)
  const fromStoryMode = searchParams?.get('from') === 'story'
  
  // Lade Library-Daten für Header
  const [library, setLibrary] = useState<PublicLibrary | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(true)
  
  useEffect(() => {
    async function loadLibrary() {
      if (!slug) {
        setLibraryLoading(false)
        return
      }
      
      try {
        const response = await fetch(`/api/public/libraries/${slug}`)
        if (response.ok) {
          const data = await response.json()
          setLibrary(data.library)
        }
      } catch (err) {
        console.error('Fehler beim Laden der Library:', err)
      } finally {
        setLibraryLoading(false)
      }
    }
    
    loadLibrary()
  }, [slug])
  
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

  // Lokaler State für die Formularwerte (werden erst beim Speichern übernommen)
  const [localLanguage, setLocalLanguage] = useState<TargetLanguage>(targetLanguage)
  const [localInterests, setLocalInterests] = useState<Character[]>(character)
  const [localLanguageStyle, setLocalLanguageStyle] = useState<SocialContext>(socialContext)

  // Synchronisiere lokale Werte mit globalen Werten beim Laden
  useEffect(() => {
    setLocalLanguage(targetLanguage)
    setLocalInterests(character)
    setLocalLanguageStyle(socialContext)
  }, [targetLanguage, character, socialContext])

  /**
   * Toggle-Funktion für Interessenprofil-Auswahl (max. 3)
   */
  function toggleInterest(value: Character) {
    if (localInterests.includes(value)) {
      setLocalInterests(localInterests.filter((i) => i !== value))
    } else if (localInterests.length < 3) {
      setLocalInterests([...localInterests, value])
    }
  }

  /**
   * Handler für "Mit dieser Perspektive starten" Button
   */
  function handleStart() {
    // Validiere: Mindestens 1 Interesse muss ausgewählt sein
    if (localInterests.length === 0) {
      return
    }

    // Übernehme Werte in globalen State
    setTargetLanguage(localLanguage)
    setCharacter(localInterests)
    setSocialContext(localLanguageStyle)

    // Speichere im localStorage (nur im anonymen Modus)
    if (isAnonymous) {
      saveStoryContextToLocalStorage(localLanguage, localInterests, localLanguageStyle, isAnonymous)
    }

    // Setze Flag, dass Perspektive einmal gesetzt wurde
    if (typeof window !== 'undefined') {
      localStorage.setItem('story-perspective-set', 'true')
    }

    // Navigiere zurück zur Story-Mode-Seite
    router.push(`/explore/${slug}?mode=story`)
  }

  function handleBack() {
    if (fromStoryMode) {
      // Wenn vom Story Mode aufgerufen, zurück zum Story Mode
      router.push(`/explore/${slug}?mode=story`)
    } else {
      // Wenn automatisch von Gallery->Story Mode aufgerufen, zurück zur Gallery
      router.push(`/explore/${slug}`)
    }
  }
  
  function handleModeChange(value: string) {
    const newMode = value as 'gallery' | 'story'
    if (newMode === 'story') {
      router.push(`/explore/${slug}?mode=story`)
    } else {
      router.push(`/explore/${slug}`)
    }
  }

  const canProceed = localInterests.length > 0 && !!localLanguageStyle

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      {/* Header mit integrierten Tabs - gleiche Struktur wie Hauptseite */}
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex items-start justify-between gap-2 sm:gap-4 px-3 py-2 sm:py-4">
          {/* Linker Bereich: Zurück-Button + Titel als Logo/Label */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Prominenter Zurück-Button zur Homepage */}
            <Link href="/" className="flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-muted/50"
                aria-label={t('common.backToHome')}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            {/* Titel als Logo/Label */}
            {!libraryLoading && library && (
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {t('explore.publicLibrary')}
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
        <div className="space-y-6 p-6 md:p-10 pb-16 max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
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
                onClick={handleBack}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('gallery.storyMode.storyModePerspectivePage.title')}
            </h1>
            <p className="text-base text-muted-foreground">
              {t('gallery.storyMode.storyModePerspectivePage.subtitle')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('gallery.storyMode.storyModePerspectivePage.description')}
            </p>
          </div>

        <Separator className="my-6" />

        {/* Optional Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-medium text-sm">
                  {t('gallery.storyMode.storyModePerspectivePage.whyThisPage')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('gallery.storyMode.storyModePerspectivePage.whyThisPageDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perspective Selection */}
        <div className="space-y-6">
          {/* 1. Language */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {t('gallery.storyMode.storyModePerspectivePage.language.label')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t('gallery.storyMode.storyModePerspectivePage.language.helpText')}
                    </p>
                  </div>
                  <Select value={localLanguage} onValueChange={(v) => setLocalLanguage(v as TargetLanguage)}>
                    <SelectTrigger className="w-full">
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
              </div>
            </CardContent>
          </Card>

          {/* 2. Interests */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {t('gallery.storyMode.storyModePerspectivePage.interests.label')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t('gallery.storyMode.storyModePerspectivePage.interests.helpText')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHARACTER_VALUES.map((value) => {
                      const isSelected = localInterests.includes(value)
                      const isDisabled = !isSelected && localInterests.length >= 3
                      return (
                        <Badge
                          key={value}
                          variant={isSelected ? 'default' : 'outline'}
                          className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                            isSelected ? 'bg-primary text-primary-foreground' : ''
                          } ${
                            isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/10'
                          }`}
                          onClick={() => !isDisabled && toggleInterest(value)}
                        >
                          {characterLabels[value]}
                        </Badge>
                      )
                    })}
                  </div>
                  {localInterests.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('gallery.storyMode.storyModePerspectivePage.interests.selectedCount', {
                        count: localInterests.length,
                      })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Language Style */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {t('gallery.storyMode.storyModePerspectivePage.languageStyle.label')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t('gallery.storyMode.storyModePerspectivePage.languageStyle.helpText')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(socialContextLabels).map(([value, label]) => {
                      const isSelected = localLanguageStyle === value
                      return (
                        <Badge
                          key={value}
                          variant={isSelected ? 'default' : 'outline'}
                          className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                            isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : 'hover:bg-primary/10'
                          }`}
                          onClick={() => setLocalLanguageStyle(value as SocialContext)}
                        >
                          {label}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('gallery.storyMode.storyModePerspectivePage.languageStyle.note')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="space-y-3 pt-6">
          <Button
            size="lg"
            className="w-full gap-2 text-base"
            onClick={handleStart}
            disabled={!canProceed}
          >
            {t('gallery.storyMode.storyModePerspectivePage.button.start')}
            <ArrowRight className="h-5 w-5" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('gallery.storyMode.storyModePerspectivePage.button.footer')}
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

