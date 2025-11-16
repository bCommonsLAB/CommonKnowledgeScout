'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowRight, Globe, Compass, Eye, Users, Sparkles, ArrowLeft, X } from 'lucide-react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { useUser } from '@clerk/nextjs'
import { useTranslation } from '@/lib/i18n/hooks'
import type { Character, SocialContext, TargetLanguage, AccessPerspective } from '@/lib/chat/constants'
import { CHARACTER_VALUES, ACCESS_PERSPECTIVE_VALUES, TARGET_LANGUAGE_VALUES } from '@/lib/chat/constants'
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

  /**
   * Toggle-Funktion für Interessenprofil-Auswahl (max. 5)
   * Wenn etwas anderes als 'undefined' gewählt wird, wird 'undefined' automatisch entfernt
   */
  function toggleInterest(value: Character) {
    if (localInterests.includes(value)) {
      // Wenn abgewählt wird
      const newInterests = localInterests.filter((i) => i !== value)
      // Wenn nach dem Entfernen nichts mehr übrig ist, setze 'undefined'
      setLocalInterests(newInterests.length === 0 ? ['undefined'] : newInterests)
    } else {
      // Wenn hinzugefügt wird
      if (value === 'undefined') {
        // Wenn 'undefined' gewählt wird, entferne alle anderen
        setLocalInterests(['undefined'])
      } else {
        // Wenn etwas anderes gewählt wird, entferne 'undefined' und füge den neuen Wert hinzu
        const withoutUndefined = localInterests.filter((i) => i !== 'undefined')
        if (withoutUndefined.length < 5) {
          setLocalInterests([...withoutUndefined, value])
        }
      }
    }
  }

  /**
   * Toggle-Funktion für Zugangsperspektive-Auswahl (max. 5)
   * Wenn etwas anderes als 'undefined' gewählt wird, wird 'undefined' automatisch entfernt
   */
  function toggleAccessPerspective(value: AccessPerspective) {
    if (localAccessPerspective.includes(value)) {
      // Wenn abgewählt wird
      const newAccessPerspectives = localAccessPerspective.filter((ap) => ap !== value)
      // Wenn nach dem Entfernen nichts mehr übrig ist, setze 'undefined'
      setLocalAccessPerspective(newAccessPerspectives.length === 0 ? ['undefined'] : newAccessPerspectives)
    } else {
      // Wenn hinzugefügt wird
      if (value === 'undefined') {
        // Wenn 'undefined' gewählt wird, entferne alle anderen
        setLocalAccessPerspective(['undefined'])
      } else {
        // Wenn etwas anderes gewählt wird, entferne 'undefined' und füge den neuen Wert hinzu
        const withoutUndefined = localAccessPerspective.filter((ap) => ap !== 'undefined')
        if (withoutUndefined.length < 5) {
          setLocalAccessPerspective([...withoutUndefined, value])
        }
      }
    }
  }

  /**
   * Handler für "Mit dieser Perspektive starten" Button
   */
  function handleStart() {
    // Validiere: Mindestens 1 Interesse, 1 Zugangsperspektive und Sprachstil müssen ausgewählt sein (auch 'undefined' ist erlaubt)
    if (localInterests.length === 0 || localAccessPerspective.length === 0 || !localLanguageStyle) {
      return
    }

    // Filtere 'undefined' heraus für die Speicherung (nur wenn andere Werte vorhanden sind)
    const validInterests = localInterests.filter((i) => i !== 'undefined')
    const validAccessPerspective = localAccessPerspective.filter((ap) => ap !== 'undefined')
    
    // Übernehme Werte in globalen State
    // Wenn andere Werte vorhanden sind, verwende nur diese (ohne 'undefined')
    // Wenn nur 'undefined' vorhanden ist, verwende die originalen Arrays (mit 'undefined')
    setTargetLanguage(localLanguage)
    setCharacter(validInterests.length > 0 ? validInterests : localInterests)
    setAccessPerspective(validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective)
    setSocialContext(localLanguageStyle) // Kann auch 'undefined' sein

    // Speichere im localStorage (nur im anonymen Modus)
    // Speichere die gefilterten Werte (ohne 'undefined'), außer wenn nur 'undefined' vorhanden ist
    if (isAnonymous) {
      saveStoryContextToLocalStorage(
        localLanguage,
        validInterests.length > 0 ? validInterests : localInterests,
        localLanguageStyle,
        validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective,
        isAnonymous
      )
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

  // Prüfe, ob eine Auswahl getroffen wurde (auch 'undefined' ist erlaubt)
  const canProceed = localInterests.length > 0 && localAccessPerspective.length > 0 && !!localLanguageStyle

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
              {t('chat.perspectivePage.title')}
            </h1>
            <p className="text-base text-muted-foreground">
              {t('chat.perspectivePage.subtitle')}
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
                  {t('chat.perspectivePage.whyThisPageTitle')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('chat.perspectivePage.whyThisPageText')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Perspective Selection */}
        <TooltipProvider>
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
                        {t('chat.perspectivePage.languageSectionTitle')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('chat.perspectivePage.languageSectionHelp')}
                      </p>
                    </div>
                    <Select value={localLanguage} onValueChange={(v) => setLocalLanguage(v as TargetLanguage)}>
                      <SelectTrigger className="w-full">
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
                </div>
              </CardContent>
            </Card>

            {/* 2. Thematische Interessen */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Compass className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t('chat.perspectivePage.characterSectionTitle')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('chat.perspectivePage.characterSectionHelp')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CHARACTER_VALUES.map((value) => {
                        const isSelected = localInterests.includes(value)
                        // Für 'undefined': Disabled wenn andere Werte gewählt wurden
                        // Für andere Werte: Disabled wenn bereits 5 gewählt (ohne 'undefined')
                        const currentValidCount = localInterests.filter((i) => i !== 'undefined').length
                        const isDisabled = value === 'undefined' 
                          ? currentValidCount > 0
                          : !isSelected && currentValidCount >= 5
                        const tooltipText = t(`chat.characterTooltips.${value}`)
                        return (
                          <Tooltip key={value}>
                            <TooltipTrigger asChild>
                              <Badge
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
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{tooltipText}</p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                    {localInterests.filter((i) => i !== 'undefined').length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('chat.perspectivePage.characterSectionSelectedCount', {
                          count: localInterests.filter((i) => i !== 'undefined').length,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Zugangsperspektive */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Eye className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t('chat.perspectivePage.accessPerspectiveSectionTitle')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('chat.perspectivePage.accessPerspectiveSectionHelp')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ACCESS_PERSPECTIVE_VALUES.map((value) => {
                        const isSelected = localAccessPerspective.includes(value)
                        // Für 'undefined': Disabled wenn andere Werte gewählt wurden
                        // Für andere Werte: Disabled wenn bereits 5 gewählt (ohne 'undefined')
                        const validAccessPerspectiveCount = localAccessPerspective.filter((ap) => ap !== 'undefined').length
                        const isDisabled = value === 'undefined' 
                          ? validAccessPerspectiveCount > 0
                          : !isSelected && validAccessPerspectiveCount >= 5
                        const tooltipText = t(`chat.accessPerspectiveTooltips.${value}`)
                        return (
                          <Tooltip key={value}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={isSelected ? 'default' : 'outline'}
                                className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                                  isSelected ? 'bg-primary text-primary-foreground' : ''
                                } ${
                                  isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/10'
                                }`}
                                onClick={() => !isDisabled && toggleAccessPerspective(value)}
                              >
                                {accessPerspectiveLabels[value]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{tooltipText}</p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                    {localAccessPerspective.filter((ap) => ap !== 'undefined').length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('chat.perspectivePage.accessPerspectiveSectionSelectedCount', {
                          count: localAccessPerspective.filter((ap) => ap !== 'undefined').length,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Sprachstil */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t('chat.perspectivePage.socialContextSectionTitle')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('chat.perspectivePage.socialContextSectionHelp')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(socialContextLabels).map(([value, label]) => {
                        const isSelected = localLanguageStyle === value
                        const tooltipText = t(`chat.socialContextTooltips.${value}`)
                        return (
                          <Tooltip key={value}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={isSelected ? 'default' : 'outline'}
                                className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                                  isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : 'hover:bg-primary/10'
                                }`}
                                onClick={() => setLocalLanguageStyle(value as SocialContext)}
                              >
                                {label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{tooltipText}</p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('chat.perspectivePage.socialContextSectionNote')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>

        {/* CTA */}
        <div className="space-y-3 pt-6">
          <Button
            size="lg"
            className="w-full gap-2 text-base"
            onClick={handleStart}
            disabled={!canProceed}
          >
            {t('chat.perspectivePage.saveButton')}
            <ArrowRight className="h-5 w-5" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('chat.perspectivePage.saveButtonFooter')}
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

