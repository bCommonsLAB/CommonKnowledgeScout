'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowRight, Globe, Compass, Eye, Users, Sparkles, ArrowLeft, X, AlertCircle, ExternalLink } from 'lucide-react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { useTranslation } from '@/lib/i18n/hooks'
import type { Character, SocialContext, TargetLanguage, AccessPerspective, LlmModelId } from '@/lib/chat/constants'
import { CHARACTER_VALUES, ACCESS_PERSPECTIVE_VALUES, TARGET_LANGUAGE_VALUES, getLanguageCategory, TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants'
import { useUser } from '@clerk/nextjs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useMemo } from 'react'

interface LibraryInfo {
  id: string
  label: string
}

export interface PerspectivePageContentProps {
  /** Library-Informationen */
  library: LibraryInfo | null
  /** Loading-Status für Library */
  libraryLoading: boolean
  /** Callback für Zurück-Navigation */
  onBack: () => void
  /** Callback für Modus-Wechsel */
  onModeChange: (mode: 'gallery' | 'story') => void
  /** Callback für Speichern und Weiterleitung */
  onSave: () => void
  /** Ob die Seite vom Story Mode aufgerufen wurde */
  fromStoryMode?: boolean
}

/**
 * Gemeinsame Komponente für die Perspektivenauswahl-Seite
 * 
 * Wird sowohl von /explore/[slug]/perspective als auch von /library/gallery/perspective verwendet
 */
export function PerspectivePageContent({
  library,
  libraryLoading,
  onBack,
  onModeChange,
  onSave,
  fromStoryMode = false,
}: PerspectivePageContentProps) {
  const { t, locale } = useTranslation()
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn

  const {
    targetLanguage,
    setTargetLanguage,
    character,
    setCharacter,
    accessPerspective,
    setAccessPerspective,
    socialContext,
    setSocialContext,
    llmModel: storyLlmModel,
    setLlmModel,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
  } = useStoryContext()
  
  // Stelle sicher, dass llmModel immer einen Wert hat
  const llmModel = storyLlmModel || ''
  
  console.log('[PerspectivePage] useStoryContext Rückgabe:', {
    storyLlmModel,
    llmModel,
    hasLlmModel: !!storyLlmModel,
  })

  // Konvertiere UI-Locale zu TargetLanguage
  const localeToTargetLanguage = (locale: string): TargetLanguage => {
    const mapping: Record<string, TargetLanguage> = {
      de: 'de',
      en: 'en',
      it: 'it',
      fr: 'fr',
      es: 'es',
      pt: 'pt',
      nl: 'nl',
      no: 'no',
      da: 'da',
      sv: 'sv',
      fi: 'fi',
      pl: 'pl',
      cs: 'cs',
      hu: 'hu',
      ro: 'ro',
      bg: 'bg',
      el: 'el',
      tr: 'tr',
      ru: 'ru',
      uk: 'uk',
      zh: 'zh',
      ko: 'ko',
      ja: 'ja',
      hr: 'hr',
      sr: 'sr',
      bs: 'bs',
      sl: 'sl',
      sk: 'sk',
      lt: 'lt',
      lv: 'lv',
      et: 'et',
      id: 'id',
      ms: 'ms',
      hi: 'hi',
      sw: 'sw',
      yo: 'yo',
      zu: 'zu',
    }
    return mapping[locale] || TARGET_LANGUAGE_DEFAULT
  }

  // Sortiere Sprachen: 'global' zuerst, dann aktuelle UI-Sprache, dann alphabetisch
  const sortedLanguages = useMemo(() => {
    const currentUILanguage = localeToTargetLanguage(locale)
    const allLanguages = [...TARGET_LANGUAGE_VALUES]
    
    // Trenne 'global', aktuelle Sprache und restliche Sprachen
    const globalLanguage = allLanguages.find(lang => lang === 'global')
    const currentLanguage = allLanguages.find(lang => lang === currentUILanguage && lang !== 'global')
    const otherLanguages = allLanguages.filter(lang => lang !== 'global' && lang !== currentUILanguage)
    
    // Sortiere restliche Sprachen alphabetisch nach Label
    const sortedOtherLanguages = otherLanguages.sort((a, b) => {
      const labelA = targetLanguageLabels[a] || ''
      const labelB = targetLanguageLabels[b] || ''
      return labelA.localeCompare(labelB, locale, { sensitivity: 'base' })
    })
    
    // Füge 'global' zuerst hinzu, dann aktuelle Sprache, dann restliche
    const result: TargetLanguage[] = []
    if (globalLanguage) result.push(globalLanguage)
    if (currentLanguage) result.push(currentLanguage)
    result.push(...sortedOtherLanguages)
    
    return result
  }, [locale, targetLanguageLabels])

  // Lokaler State für die Formularwerte (werden erst beim Speichern übernommen)
  console.log('[PerspectivePage] Initialisiere States:', {
    targetLanguage,
    llmModel,
    character,
    accessPerspective,
    socialContext,
  })
  
  const [localLanguage, setLocalLanguage] = useState<TargetLanguage>(targetLanguage)
  const [localInterests, setLocalInterests] = useState<Character[]>(character)
  const [localAccessPerspective, setLocalAccessPerspective] = useState<AccessPerspective[]>(accessPerspective)
  const [localLanguageStyle, setLocalLanguageStyle] = useState<SocialContext>(socialContext)
  const [localLlmModel, setLocalLlmModel] = useState<LlmModelId>(llmModel || '')
  
  console.log('[PerspectivePage] States initialisiert:', {
    localLanguage,
    localLlmModel,
    hasLlmModel: !!llmModel,
  })
  
  // State für LLM-Modelle
  const [availableModels, setAvailableModels] = useState<Array<{
    modelId: string
    name: string
    strengths: string
    supportedLanguages: TargetLanguage[]
    url?: string
    order: number
  }>>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelAutoSwitched, setModelAutoSwitched] = useState(false)

  // Synchronisiere lokale Werte mit globalen Werten nur beim initialen Laden
  // WICHTIG: Nicht bei jeder Änderung synchronisieren, da sonst lokale Änderungen überschrieben werden
  const [isInitialized, setIsInitialized] = useState(false)
  useEffect(() => {
    if (!isInitialized) {
      console.log('[PerspectivePage] Initiale Synchronisation lokaler Werte:', {
        targetLanguage,
        llmModel,
        character,
        accessPerspective,
        socialContext,
        currentLocalLlmModel: localLlmModel,
      })
      setLocalLanguage(targetLanguage)
      setLocalInterests(character)
      setLocalAccessPerspective(accessPerspective)
      setLocalLanguageStyle(socialContext)
      if (llmModel) {
        setLocalLlmModel(llmModel)
      }
      setIsInitialized(true)
    }
  }, [targetLanguage, character, accessPerspective, socialContext, llmModel, isInitialized, localLlmModel])
  
  // Lade LLM-Modelle beim Mount
  useEffect(() => {
    console.log('[PerspectivePage] Starte Laden der LLM-Modelle...')
    async function loadModels() {
      try {
        setModelsLoading(true)
        console.log('[PerspectivePage] Fetching /api/public/llm-models...')
        const res = await fetch('/api/public/llm-models')
        if (!res.ok) {
          console.error('[PerspectivePage] Fehler beim Laden der Modelle:', res.status)
          return
        }
        const models = await res.json() as Array<{
          _id: string
          name: string
          strengths: string
          supportedLanguages: TargetLanguage[]
          url?: string
          order: number
        }>
        console.log('[PerspectivePage] Modelle geladen:', {
          count: models.length,
          models: models.map(m => ({ id: m._id, name: m.name })),
        })
        const mappedModels = models.map(m => ({
          modelId: m._id,
          name: m.name,
          strengths: m.strengths,
          supportedLanguages: m.supportedLanguages,
          url: m.url,
          order: m.order,
        }))
        setAvailableModels(mappedModels)
        console.log('[PerspectivePage] availableModels gesetzt:', mappedModels.length)
      } catch (error) {
        console.error('[PerspectivePage] Fehler beim Laden der Modelle:', error)
      } finally {
        setModelsLoading(false)
        console.log('[PerspectivePage] modelsLoading auf false gesetzt')
      }
    }
    loadModels()
  }, [])
  
  // Filtere Modelle basierend auf gewählter Sprache
  const filteredModels = useMemo(() => {
    console.log('[PerspectivePage] Filtere Modelle:', {
      localLanguage,
      availableModelsCount: availableModels.length,
      availableModels: availableModels.map(m => ({ id: m.modelId, name: m.name, languages: m.supportedLanguages })),
    })
    let filtered: typeof availableModels
    if (localLanguage === 'global') {
      // Bei 'global' alle Modelle anzeigen
      filtered = availableModels.sort((a, b) => a.order - b.order)
    } else {
      filtered = availableModels
        .filter(model => model.supportedLanguages.includes(localLanguage))
        .sort((a, b) => a.order - b.order)
    }
    console.log('[PerspectivePage] Gefilterte Modelle:', {
      count: filtered.length,
      models: filtered.map(m => ({ id: m.modelId, name: m.name })),
    })
    return filtered
  }, [availableModels, localLanguage])
  
  // Handler für Sprachänderung: Prüfe Modell-Kompatibilität
  const handleLanguageChange = useCallback((newLanguage: TargetLanguage) => {
    setLocalLanguage(newLanguage)
    // WICHTIG: Speichere Sprache sofort im Story Context, damit sie nicht zurückgesetzt wird
    setTargetLanguage(newLanguage)
    setModelAutoSwitched(false)
    
    // Berechne verfügbare Modelle für die neue Sprache
    const modelsForNewLanguage = newLanguage === 'global'
      ? availableModels.sort((a, b) => a.order - b.order)
      : availableModels
          .filter(model => model.supportedLanguages.includes(newLanguage))
          .sort((a, b) => a.order - b.order)
    
    // Prüfe, ob aktuelles Modell die neue Sprache unterstützt
    if (localLlmModel) {
      const currentModel = availableModels.find(m => m.modelId === localLlmModel)
      if (currentModel && newLanguage !== 'global') {
        const supportsLanguage = currentModel.supportedLanguages.includes(newLanguage)
        if (!supportsLanguage) {
          // Modell unterstützt Sprache nicht → wähle erstes verfügbares Modell
          if (modelsForNewLanguage.length > 0) {
            const newModelId = modelsForNewLanguage[0].modelId
            setLocalLlmModel(newModelId)
            setLlmModel(newModelId) // Speichere auch sofort im Story Context
            setModelAutoSwitched(true)
          }
        }
      }
    } else if (modelsForNewLanguage.length > 0) {
      // Kein Modell gewählt → wähle erstes verfügbares Modell
      const newModelId = modelsForNewLanguage[0].modelId
      setLocalLlmModel(newModelId)
      setLlmModel(newModelId) // Speichere auch sofort im Story Context
    }
  }, [localLlmModel, availableModels, setTargetLanguage, setLlmModel])
  
  // Initialisiere Modell, wenn noch keines gewählt ist
  useEffect(() => {
    console.log('[PerspectivePage] Prüfe Modell-Initialisierung:', {
      localLlmModel,
      filteredModelsCount: filteredModels.length,
      modelsLoading,
      firstModel: filteredModels[0]?.modelId,
    })
    if (!localLlmModel && filteredModels.length > 0 && !modelsLoading) {
      const firstModelId = filteredModels[0].modelId
      console.log('[PerspectivePage] Setze initiales Modell:', firstModelId)
      setLocalLlmModel(firstModelId)
    }
  }, [localLlmModel, filteredModels, modelsLoading])

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
    console.log('[PerspectivePage] handleStart - Setze targetLanguage:', {
      localLanguage,
      currentTargetLanguage: targetLanguage,
      willSetTo: localLanguage,
    })
    setTargetLanguage(localLanguage)
    setCharacter(validInterests.length > 0 ? validInterests : localInterests)
    setAccessPerspective(validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective)
    setSocialContext(localLanguageStyle) // Kann auch 'undefined' sein
    setLlmModel(localLlmModel) // Übernehme LLM-Modell in Story Context

    // Speichere im localStorage (für alle Benutzer, nicht nur anonyme)
    // Speichere die gefilterten Werte (ohne 'undefined'), außer wenn nur 'undefined' vorhanden ist
    // WICHTIG: Speichere immer, damit die Perspektivwahl beim nächsten Besuch erhalten bleibt
    console.log('[PerspectivePage] handleStart - Speichere in localStorage:', {
      targetLanguage: localLanguage,
      character: validInterests.length > 0 ? validInterests : localInterests,
      socialContext: localLanguageStyle,
      accessPerspective: validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective,
      isAnonymous,
    })
    saveStoryContextToLocalStorage(
      localLanguage,
      validInterests.length > 0 ? validInterests : localInterests,
      localLanguageStyle,
      validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective,
      localLlmModel,
      isAnonymous
    )

    // Setze Flag, dass Perspektive einmal gesetzt wurde
    if (typeof window !== 'undefined') {
      localStorage.setItem('story-perspective-set', 'true')
      console.log('[PerspectivePage] Flag "story-perspective-set" gesetzt')
    }

    // Rufe onSave Callback auf (für Navigation)
    onSave()
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
            {/* Prominenter Zurück-Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-muted/50"
              onClick={onBack}
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
            <Tabs value="story" onValueChange={(value) => onModeChange(value as 'gallery' | 'story')} className="w-auto">
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
            {/* 1. Sprache (vereinfacht) */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t('chat.perspectivePage.languageSectionTitle')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('chat.perspectivePage.languageSectionHelp')}
                      </p>
                    </div>
                    {/* Sprachauswahl */}
                    <div className="space-y-2">
                      <Select value={localLanguage} onValueChange={(v) => handleLanguageChange(v as TargetLanguage)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedLanguages.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {targetLanguageLabels[lang]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Warnhinweise für exotische Sprachen */}
                    {(() => {
                      // Keine Warnung für 'global', da es die UI-Sprache verwendet
                      if (localLanguage === 'global') {
                        return null
                      }
                      const category = getLanguageCategory(localLanguage)
                      if (category === 'well') {
                        return (
                          <Alert className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                            <AlertTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
                              {t('chat.languageWarning.wellSupported.title')}
                            </AlertTitle>
                            <AlertDescription className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                              {t('chat.languageWarning.wellSupported.description')}
                              <br />
                              <span className="text-xs mt-1 block">
                                <strong>{t('chat.languageWarning.wellSupported.languages')}</strong>
                              </span>
                            </AlertDescription>
                          </Alert>
                        )
                      }
                      if (category === 'basic') {
                        return (
                          <Alert className="mt-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                            <AlertTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                              {t('chat.languageWarning.basicSupport.title')}
                            </AlertTitle>
                            <AlertDescription className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                              {t('chat.languageWarning.basicSupport.description')}
                              <br />
                              <span className="text-xs mt-1 block">
                                <strong>{t('chat.languageWarning.basicSupport.languages')}</strong>
                              </span>
                            </AlertDescription>
                          </Alert>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. LLM Modell (separater Teaser mit Magic-Icon) */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t('chat.perspectivePage.modelLabel')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t('chat.perspectivePage.modelInfo')}
                      </p>
                    </div>
                    
                    {/* LLM Modell-Auswahl (gefiltert basierend auf Sprache) */}
                    <div className="space-y-2">
                      {(() => {
                        console.log('[PerspectivePage] Rendere Modell-Auswahl:', {
                          modelsLoading,
                          filteredModelsCount: filteredModels?.length || 0,
                          localLlmModel,
                          hasFilteredModels: !!filteredModels,
                        })
                        if (modelsLoading) {
                          return <div className="text-sm text-muted-foreground">Lade Modelle...</div>
                        }
                        if (!filteredModels || filteredModels.length === 0) {
                          return (
                            <div className="text-sm text-muted-foreground">
                              {t('chat.perspectivePage.noModelsAvailable')}
                            </div>
                          )
                        }
                        return (
                          <>
                            <Select value={localLlmModel || ''} onValueChange={(v) => {
                              console.log('[PerspectivePage] Modell geändert:', v)
                              setLocalLlmModel(v)
                              setLlmModel(v) // Übernehme sofort in Story Context
                            }}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredModels.map((model) => (
                                  <SelectItem key={model.modelId} value={model.modelId}>
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span>{model.name}</span>
                                        {model.url && (
                                          <a 
                                            href={model.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs text-muted-foreground hover:text-primary"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {model.strengths}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {modelAutoSwitched && (
                              <Alert className="mt-2 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                                <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                                  {t('chat.perspectivePage.modelAutoSwitched', { 
                                    model: filteredModels.find(m => m.modelId === localLlmModel)?.name || '',
                                    language: targetLanguageLabels[localLanguage]
                                  })}
                                </AlertDescription>
                              </Alert>
                            )}
                          </>
                        )
                      })()}
                    </div>
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

