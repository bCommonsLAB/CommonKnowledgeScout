'use client'

/**
 * Hook fuer die Daten-Logik von PerspectivePageContent.
 *
 * Kapselt:
 * - useStoryContext (globaler Perspektiv-State)
 * - Initialisierung lokaler Form-States
 * - LLM-Modell-Laden via API
 * - Handler fuer Sprach-/Modell-Aenderungen
 * - handleStart-Logik
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useStoryContext, saveStoryContextToLocalStorage } from '@/hooks/use-story-context'
import { useTranslation } from '@/lib/i18n/hooks'
import { useUser } from '@clerk/nextjs'
import type { Character, SocialContext, TargetLanguage, AccessPerspective, LlmModelId } from '@/lib/chat/constants'
import { TARGET_LANGUAGE_VALUES } from '@/lib/chat/constants'
import { localeToTargetLanguage, mapLlmModels, filterModelsByLanguage, type MappedLlmModel } from '../helpers'

export interface PerspectiveFormState {
  /** Aktuell gewaehlte Sprache (lokal, nicht gespeichert bis handleStart) */
  localLanguage: TargetLanguage
  setLocalLanguage: (lang: TargetLanguage) => void
  /** Aktuell gewaehlte Interessenprofile */
  localInterests: Character[]
  setLocalInterests: (interests: Character[]) => void
  /** Aktuell gewaehlte Zugangsperspektiven */
  localAccessPerspective: AccessPerspective[]
  setLocalAccessPerspective: (ap: AccessPerspective[]) => void
  /** Aktuell gewaehlter Sprachstil */
  localLanguageStyle: SocialContext
  setLocalLanguageStyle: (ctx: SocialContext) => void
  /** Aktuell gewaehltes LLM-Modell */
  localLlmModel: LlmModelId
  setLocalLlmModel: (model: LlmModelId) => void
}

export interface PerspectiveModelsState {
  /** Alle verfuegbaren Modelle (nach API-Load) */
  availableModels: MappedLlmModel[]
  /** Lade-Status der Modellliste */
  modelsLoading: boolean
  /** Ob Modell automatisch umgeschaltet wurde (wegen Sprachkompatibilitaet) */
  modelAutoSwitched: boolean
  /** Gefilterte Modelle fuer die aktuell gewaehlte Sprache */
  filteredModels: MappedLlmModel[]
}

export interface PerspectiveDataResult {
  form: PerspectiveFormState
  models: PerspectiveModelsState
  /** Sortierte Sprachen-Liste: global → aktuelle UI-Sprache → alphabetisch */
  sortedLanguages: TargetLanguage[]
  /** Labels aus useStoryContext */
  targetLanguageLabels: Record<TargetLanguage, string>
  characterLabels: Record<Character, string>
  accessPerspectiveLabels: Record<AccessPerspective, string>
  socialContextLabels: Record<SocialContext, string>
  /** true wenn Formular valide und "Starten" moeglich ist */
  canProceed: boolean
  /** Ob der Nutzer anonym ist (nicht eingeloggt) */
  isAnonymous: boolean
  /** Handler fuer Sprachauswahl-Aenderungen (inkl. Modell-Kompatibilitaets-Check) */
  handleLanguageChange: (newLanguage: TargetLanguage) => void
  /** Handler fuer "Mit dieser Perspektive starten" */
  handleStart: (onSave: () => void) => void
}

/**
 * Zentraler Daten-Hook fuer PerspectivePageContent.
 * Kapselt alle State- und Effekt-Logik der Perspektiv-Seite.
 */
export function usePerspectiveData(): PerspectiveDataResult {
  const { locale } = useTranslation()
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

  // Stelle sicher, dass llmModel immer einen Wert hat (niemals undefined)
  const llmModel = storyLlmModel || ''

  // --- Lokale Form-States (werden erst beim Speichern uebernommen) ---
  const [localLanguage, setLocalLanguage] = useState<TargetLanguage>(targetLanguage)
  const [localInterests, setLocalInterests] = useState<Character[]>(character)
  const [localAccessPerspective, setLocalAccessPerspective] = useState<AccessPerspective[]>(accessPerspective)
  const [localLanguageStyle, setLocalLanguageStyle] = useState<SocialContext>(socialContext)
  const [localLlmModel, setLocalLlmModel] = useState<LlmModelId>(llmModel || '')

  // --- Modell-States ---
  const [availableModels, setAvailableModels] = useState<MappedLlmModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelAutoSwitched, setModelAutoSwitched] = useState(false)

  // --- Initialisierungs-Flag ---
  // WICHTIG: localLlmModel NICHT in Dependencies — sonst wird isInitialized zu
  // frueh true gesetzt und ein spaeter nachziehendes llmModel aus useStoryContext
  // (API-Validierung) koennte den Select nie mehr aktualisieren.
  const [isInitialized, setIsInitialized] = useState(false)
  useEffect(() => {
    if (isInitialized) return

    const atomModel = typeof llmModel === 'string' ? llmModel.trim() : ''
    const candidates = filterModelsByLanguage(availableModels, targetLanguage)
    const fallbackModelId = candidates[0]?.modelId ?? ''

    // Noch kein Modell im Atom und Liste noch nicht geladen → warten
    if (!atomModel && modelsLoading) return

    setLocalLanguage(targetLanguage)
    setLocalInterests(character)
    setLocalAccessPerspective(accessPerspective)
    setLocalLanguageStyle(socialContext)
    setLocalLlmModel(atomModel || fallbackModelId)
    setIsInitialized(true)
  }, [
    targetLanguage,
    character,
    accessPerspective,
    socialContext,
    llmModel,
    isInitialized,
    modelsLoading,
    availableModels,
  ])

  // --- LLM-Modelle laden ---
  useEffect(() => {
    async function loadModels() {
      try {
        setModelsLoading(true)
        const res = await fetch('/api/public/llm-models')
        if (!res.ok) {
          console.warn('[usePerspectiveData] Fehler beim Laden der LLM-Modelle:', res.status)
          return
        }
        const raw = await res.json() as Parameters<typeof mapLlmModels>[0]
        setAvailableModels(mapLlmModels(raw))
      } catch (error) {
        // Netzwerk-/Parse-Fehler: Nutzer sieht leere Modell-Liste, kein Crash
        console.warn('[usePerspectiveData] Unerwarteter Fehler beim Laden der LLM-Modelle:', error)
      } finally {
        setModelsLoading(false)
      }
    }
    loadModels()
  }, [])

  // --- Gefilterte Modelle ---
  const filteredModels = useMemo(
    () => filterModelsByLanguage(availableModels, localLanguage),
    [availableModels, localLanguage],
  )

  // --- Modell-Initialisierung / Korrektur ungültiger Werte ---
  useEffect(() => {
    if (modelsLoading || filteredModels.length === 0) return
    const isCurrentValid = localLlmModel && filteredModels.some((m) => m.modelId === localLlmModel)
    if (!isCurrentValid) {
      setLocalLlmModel(filteredModels[0].modelId)
    }
  }, [localLlmModel, filteredModels, modelsLoading])

  // --- Sortierte Sprachen ---
  const sortedLanguages = useMemo(() => {
    const currentUILanguage = localeToTargetLanguage(locale)
    const all = [...TARGET_LANGUAGE_VALUES]
    const globalLang = all.find((l) => l === 'global')
    const currentLang = all.find((l) => l === currentUILanguage && l !== 'global')
    const others = all
      .filter((l) => l !== 'global' && l !== currentUILanguage)
      .sort((a, b) => {
        const labelA = targetLanguageLabels[a] || ''
        const labelB = targetLanguageLabels[b] || ''
        return labelA.localeCompare(labelB, locale, { sensitivity: 'base' })
      })
    const result: TargetLanguage[] = []
    if (globalLang) result.push(globalLang)
    if (currentLang) result.push(currentLang)
    result.push(...others)
    return result
  }, [locale, targetLanguageLabels])

  // --- Handler ---
  const handleLanguageChange = useCallback(
    (newLanguage: TargetLanguage) => {
      setLocalLanguage(newLanguage)
      // Sprache sofort im Story Context speichern (verhindert Zuruecksetzen)
      setTargetLanguage(newLanguage)
      setModelAutoSwitched(false)

      const modelsForLanguage = filterModelsByLanguage(availableModels, newLanguage)

      if (localLlmModel) {
        const currentModel = availableModels.find((m) => m.modelId === localLlmModel)
        if (currentModel && newLanguage !== 'global') {
          if (!currentModel.supportedLanguages.includes(newLanguage) && modelsForLanguage.length > 0) {
            const newModelId = modelsForLanguage[0].modelId
            setLocalLlmModel(newModelId)
            setLlmModel(newModelId)
            setModelAutoSwitched(true)
          }
        }
      } else if (modelsForLanguage.length > 0) {
        const newModelId = modelsForLanguage[0].modelId
        setLocalLlmModel(newModelId)
        setLlmModel(newModelId)
      }
    },
    [localLlmModel, availableModels, setTargetLanguage, setLlmModel],
  )

  const handleStart = useCallback(
    (onSave: () => void) => {
      if (localInterests.length === 0 || localAccessPerspective.length === 0 || !localLanguageStyle) {
        return
      }
      const validInterests = localInterests.filter((i) => i !== 'undefined')
      const validAccessPerspective = localAccessPerspective.filter((ap) => ap !== 'undefined')

      setTargetLanguage(localLanguage)
      setCharacter(validInterests.length > 0 ? validInterests : localInterests)
      setAccessPerspective(validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective)
      setSocialContext(localLanguageStyle)
      setLlmModel(localLlmModel)

      saveStoryContextToLocalStorage(
        localLanguage,
        validInterests.length > 0 ? validInterests : localInterests,
        localLanguageStyle,
        validAccessPerspective.length > 0 ? validAccessPerspective : localAccessPerspective,
        localLlmModel,
        isAnonymous,
      )

      if (typeof window !== 'undefined') {
        localStorage.setItem('story-perspective-set', 'true')
      }

      onSave()
    },
    [
      localInterests,
      localAccessPerspective,
      localLanguageStyle,
      localLanguage,
      localLlmModel,
      isAnonymous,
      setTargetLanguage,
      setCharacter,
      setAccessPerspective,
      setSocialContext,
      setLlmModel,
    ],
  )

  const canProceed =
    localInterests.length > 0 && localAccessPerspective.length > 0 && !!localLanguageStyle

  return {
    form: {
      localLanguage,
      setLocalLanguage,
      localInterests,
      setLocalInterests,
      localAccessPerspective,
      setLocalAccessPerspective,
      localLanguageStyle,
      setLocalLanguageStyle,
      localLlmModel,
      setLocalLlmModel,
    },
    models: {
      availableModels,
      modelsLoading,
      modelAutoSwitched,
      filteredModels,
    },
    sortedLanguages,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
    canProceed,
    isAnonymous,
    handleLanguageChange,
    handleStart,
  }
}
