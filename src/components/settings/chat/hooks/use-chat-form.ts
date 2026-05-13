"use client"

/**
 * useChatForm — zentraler Hook für ChatForm.
 *
 * Kapselt:
 * - Zod-Schema + Typen
 * - React-Hook-Form Initialisierung
 * - useEffect zum Befüllen der Form aus der aktiven Library
 * - Thumbnail-Statistiken (laden, reparieren, regenerieren, Varianten)
 * - onSubmit Handler
 *
 * Extrahiert aus chat-form.tsx im Zuge von Welle 3-IV-b (Modul-Split).
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useEffect, useState, useCallback, useMemo } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { toast } from "@/components/ui/use-toast"
import { buildVectorSearchIndexDefinitionForLibrary, getCollectionNameForLibrary } from '@/lib/chat/vector-search-index'
import {
  TARGET_LANGUAGE_ZOD_ENUM,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_ARRAY_ZOD_SCHEMA,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_ZOD_ENUM,
  SOCIAL_CONTEXT_DEFAULT,
  isValidSocialContext,
  isValidCharacterArray,
  isValidTargetLanguage,
  normalizeCharacterToArray,
  type Character,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import type { Library } from '@/types/library'
import { getDefaultFacets, getDefaultEmbeddings } from '@/lib/chat/config'
import { normalizeGalleryCardDensity } from '@/lib/gallery/gallery-card-density'

// Zod-Schema für Chat-Konfiguration
export const chatFormSchema = z.object({
  placeholder: z.string().optional(),
  maxChars: z.coerce.number().int().positive().max(4000).optional(),
  maxCharsWarningMessage: z.string().optional(),
  footerText: z.string().optional(),
  companyLink: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  embeddings: z.object({
    embeddingModel: z.string().optional(),
    chunkSize: z.coerce.number().int().positive().optional(),
    chunkOverlap: z.coerce.number().int().nonnegative().optional(),
    dimensions: z.coerce.number().int().positive().optional(),
  }).optional(),
  /** Standard-LLM-Modell für Chat-Antworten */
  chatLlmModel: z.string().optional(),
  targetLanguage: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return TARGET_LANGUAGE_DEFAULT
      return val
    },
    TARGET_LANGUAGE_ZOD_ENUM.default(TARGET_LANGUAGE_DEFAULT)
  ),
  character: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return CHARACTER_DEFAULT
      return normalizeCharacterToArray(val)
    },
    CHARACTER_ARRAY_ZOD_SCHEMA.default(CHARACTER_DEFAULT)
  ),
  socialContext: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return SOCIAL_CONTEXT_DEFAULT
      return val
    },
    SOCIAL_CONTEXT_ZOD_ENUM.default(SOCIAL_CONTEXT_DEFAULT)
  ),
  gallery: z.object({
    detailViewType: z.preprocess(
      (val) => {
        // Konvertiere leere Strings und undefined zu 'book'
        if (val === '' || val === undefined || val === null) return 'book';
        return val;
      },
      z.enum(['book', 'session', 'climateAction', 'testimonial', 'blog', 'divaDocument', 'divaTexture', 'refurbedDevice']).default('book')
    ),
    // Gruppierung: 'none' = keine, 'year' = nach Jahr, oder ein Facetten-Key
    groupByField: z.preprocess(
      (val) => {
        if (val === '' || val === undefined || val === null) return 'year';
        return val;
      },
      z.string().default('year')
    ),
    facets: z.array(z.object({
      metaKey: z.string().min(1),
      label: z.string().optional(),
      type: z.enum(["string","number","boolean","string[]","date","integer-range"]).default("string"),
      multi: z.boolean().default(true),
      visible: z.boolean().default(true),
      /** Wenn true, als Spalte in der Galerie-Tabellenansicht anzeigen */
      showInTable: z.boolean().optional().default(false),
      sort: z.enum(['alpha','count']).optional(),
      max: z.coerce.number().int().positive().optional(),
      columns: z.coerce.number().int().min(1).max(2).optional(),
    })).default(getDefaultFacets().slice(0, 6)),
    galleryCardDensity: z.preprocess(
      (val) => {
        if (val === '' || val === undefined || val === null) return 'comfortable'
        return val
      },
      z.enum(['compact', 'comfortable']).default('comfortable')
    ),
  }).optional(),
  /** Azure Blob Ingestion: Binary Storage */
  ingestionStorageUseCustom: z.boolean().optional(),
  ingestionConnectionString: z.string().optional(),
  ingestionContainerName: z.string().optional(),
})

export type ChatFormValues = z.infer<typeof chatFormSchema>

/** Thumbnail-Statistik */
export interface ThumbnailStats {
  total?: number
  withCoverImage?: number
  missingThumbnails?: number
  alreadyRepaired?: number
}

/** Varianten-Statistik */
export interface VariantStats {
  total?: number
  missingVariant?: number
  alreadyCorrect?: number
}

/** Rückgabe-Typ von useChatForm */
export interface UseChatFormResult {
  form: ReturnType<typeof useForm<ChatFormValues>>
  activeLibrary: ReturnType<typeof useAtom<typeof librariesAtom>>[0][number] | undefined
  isLoading: boolean
  showIndexDialog: boolean
  setShowIndexDialog: (v: boolean) => void
  showSearchIndexDialog: boolean
  setShowSearchIndexDialog: (v: boolean) => void
  indexDefinition: string
  collectionName: string
  initialFacets: Array<{ metaKey: string; type?: string }>
  thumbnailStats: ThumbnailStats | null
  isRepairingThumbnails: boolean
  repairProgress: number
  repairTotal: number
  isRegeneratingThumbnails: boolean
  regenerateProgress: number
  regenerateTotal: number
  variantStats: VariantStats | null
  isRepairingVariants: boolean
  isLoadingStats: boolean
  statsError: string | null
  healthResult: Record<string, unknown> | null
  healthError: string | null
  azureIngestionCustom: boolean
  azureContainerWatched: string
  defaultEmbeddings: ReturnType<typeof getDefaultEmbeddings>
  loadThumbnailStats: () => Promise<void>
  handleRepairThumbnails: () => Promise<void>
  handleRegenerateThumbnails: () => Promise<void>
  handleRepairVariants: () => Promise<void>
  onSubmit: (data: ChatFormValues) => Promise<void>
}

/**
 * Haupthook für das Chat-Einstellungsformular.
 * Kapselt den gesamten State und alle Handler-Funktionen.
 */
export function useChatForm(): UseChatFormResult {
  const { t } = useTranslation()
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [healthResult] = useState<Record<string, unknown> | null>(null)
  const [healthError] = useState<string | null>(null)
  const [showIndexDialog, setShowIndexDialog] = useState(false)
  const [showSearchIndexDialog, setShowSearchIndexDialog] = useState(false)
  const [indexDefinition, setIndexDefinition] = useState<string>('')
  const [collectionName, setCollectionName] = useState<string>('')
  const [initialFacets, setInitialFacets] = useState<Array<{ metaKey: string; type?: string }>>([])

  // Thumbnail-Reparatur States
  const [thumbnailStats, setThumbnailStats] = useState<ThumbnailStats | null>(null)
  const [isRepairingThumbnails, setIsRepairingThumbnails] = useState(false)
  const [repairProgress, setRepairProgress] = useState(0)
  const [repairTotal, setRepairTotal] = useState(0)

  // Thumbnail-Regenerierung States
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false)
  const [regenerateProgress, setRegenerateProgress] = useState(0)
  const [regenerateTotal, setRegenerateTotal] = useState(0)

  // Variant-Reparatur States
  const [variantStats, setVariantStats] = useState<VariantStats | null>(null)
  const [isRepairingVariants, setIsRepairingVariants] = useState(false)

  // Statistiken
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  // Stabile Referenz fuer defaultEmbeddings: getDefaultEmbeddings() liefert
  // bei jedem Aufruf ein NEUES Objekt (chatConfigSchema.parse({})). Ohne
  // useMemo wuerde der Effekt unten bei jedem Render neu laufen und via
  // form.reset() eine Endlosschleife ausloesen ("Maximum update depth").
  const defaultEmbeddings = useMemo(() => getDefaultEmbeddings(), [])

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatFormSchema),
    mode: 'onChange',
    defaultValues: {
      placeholder: t('settings.chatForm.placeholderDefault'),
      maxChars: 500,
      maxCharsWarningMessage: t('settings.chatForm.maxCharsWarningDefault'),
      footerText: "",
      companyLink: "",
      embeddings: defaultEmbeddings,
      targetLanguage: TARGET_LANGUAGE_DEFAULT,
      character: CHARACTER_DEFAULT,
      socialContext: SOCIAL_CONTEXT_DEFAULT,
      gallery: {
        detailViewType: 'book',
        groupByField: 'year',
        facets: getDefaultFacets().slice(0, 6),
        galleryCardDensity: 'comfortable',
      },
      ingestionStorageUseCustom: false,
      ingestionConnectionString: '',
      ingestionContainerName: '',
    },
  })

  const azureIngestionCustom = form.watch('ingestionStorageUseCustom') ?? false
  const azureContainerWatched = form.watch('ingestionContainerName') || ''

  // Form aus aktiver Library befüllen
  useEffect(() => {
    if (activeLibrary?.config?.chat) {
      const c = activeLibrary.config.chat as unknown as Record<string, unknown>

      console.log('[ChatForm] ===== LIBRARY LADEN START =====');
      console.log('[ChatForm] Active Library ID:', activeLibrary.id);

      const galleryConfig = c.gallery as {
        detailViewType?: unknown
        groupByField?: string
        facets?: unknown
        galleryCardDensity?: unknown
      } | undefined
      const detailViewType = galleryConfig?.detailViewType

      const validDetailViewTypes = ['book', 'session', 'climateAction', 'testimonial', 'blog', 'divaDocument', 'divaTexture', 'refurbedDevice'] as const
      type DetailViewType = typeof validDetailViewTypes[number]
      let finalViewType: DetailViewType = 'book'
      if (typeof detailViewType === 'string' && validDetailViewTypes.includes(detailViewType as DetailViewType)) {
        finalViewType = detailViewType as DetailViewType
      }

      let finalTargetLanguage: typeof TARGET_LANGUAGE_DEFAULT = TARGET_LANGUAGE_DEFAULT
      if (isValidTargetLanguage(c.targetLanguage)) {
        finalTargetLanguage = c.targetLanguage
      }

      let finalCharacter: Character[] = CHARACTER_DEFAULT
      if (isValidCharacterArray(c.character)) {
        finalCharacter = c.character
      } else {
        finalCharacter = normalizeCharacterToArray(c.character)
      }

      let finalSocialContext: typeof SOCIAL_CONTEXT_DEFAULT = SOCIAL_CONTEXT_DEFAULT
      if (isValidSocialContext(c.socialContext)) {
        finalSocialContext = c.socialContext
      }

      const rawFacets = galleryConfig?.facets
      const facetsArray = Array.isArray(rawFacets) ? rawFacets : getDefaultFacets().slice(0, 6)

      form.reset({
        placeholder: typeof c.placeholder === 'string' ? c.placeholder : t('settings.chatForm.placeholderDefault'),
        maxChars: typeof c.maxChars === 'number' ? c.maxChars : 500,
        maxCharsWarningMessage: typeof c.maxCharsWarningMessage === 'string' ? c.maxCharsWarningMessage : t('settings.chatForm.maxCharsWarningDefault'),
        footerText: typeof c.footerText === 'string' ? c.footerText : "",
        companyLink: typeof c.companyLink === 'string' ? c.companyLink : "",
        embeddings: {
          embeddingModel: typeof (c.embeddings as { embeddingModel?: string })?.embeddingModel === 'string'
            ? (c.embeddings as { embeddingModel?: string })!.embeddingModel
            : defaultEmbeddings.embeddingModel,
          chunkSize: typeof (c.embeddings as { chunkSize?: number })?.chunkSize === 'number'
            ? (c.embeddings as { chunkSize?: number })!.chunkSize
            : defaultEmbeddings.chunkSize,
          chunkOverlap: typeof (c.embeddings as { chunkOverlap?: number })?.chunkOverlap === 'number'
            ? (c.embeddings as { chunkOverlap?: number })!.chunkOverlap
            : defaultEmbeddings.chunkOverlap,
          dimensions: typeof (c.embeddings as { dimensions?: number })?.dimensions === 'number'
            ? (c.embeddings as { dimensions?: number })!.dimensions
            : defaultEmbeddings.dimensions,
        },
        chatLlmModel: (activeLibrary.config?.chat as { models?: { chat?: string } })?.models?.chat || '',
        targetLanguage: finalTargetLanguage,
        character: finalCharacter,
        socialContext: finalSocialContext,
        gallery: {
          detailViewType: finalViewType,
          groupByField: typeof galleryConfig?.groupByField === 'string' ? galleryConfig.groupByField : 'year',
          facets: facetsArray,
          galleryCardDensity: normalizeGalleryCardDensity(galleryConfig?.galleryCardDensity),
        },
        ingestionStorageUseCustom: typeof (activeLibrary.config?.ingestionStorage as { useCustomConfig?: boolean })?.useCustomConfig === 'boolean'
          ? (activeLibrary.config?.ingestionStorage as { useCustomConfig?: boolean })!.useCustomConfig
          : false,
        ingestionConnectionString: typeof (activeLibrary.config?.ingestionStorage as { connectionString?: string })?.connectionString === 'string'
          ? (activeLibrary.config?.ingestionStorage as { connectionString?: string })!.connectionString
          : '',
        ingestionContainerName: typeof (activeLibrary.config?.ingestionStorage as { containerName?: string })?.containerName === 'string'
          ? (activeLibrary.config?.ingestionStorage as { containerName?: string })!.containerName
          : '',
      })

      // Initiale Facetten für Vergleich nach onSubmit merken
      setInitialFacets(facetsArray.map((f: { metaKey?: string; type?: string }) => ({
        metaKey: typeof f.metaKey === 'string' ? f.metaKey : '',
        type: typeof f.type === 'string' ? f.type : undefined,
      })))
    }
  }, [activeLibrary, form, t, defaultEmbeddings])

  // Thumbnail-Statistiken laden
  const loadThumbnailStats = useCallback(async () => {
    if (!activeLibrary) return

    setIsLoadingStats(true)
    setStatsError(null)

    try {
      const [thumbResponse, variantResponse] = await Promise.all([
        fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails`),
        fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails?type=variants`),
      ])

      if (thumbResponse.ok) {
        const data = await thumbResponse.json()
        setThumbnailStats(data)
      }

      if (variantResponse.ok) {
        const data = await variantResponse.json()
        setVariantStats(data)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error)
      setStatsError(error instanceof Error ? error.message : 'Unbekannter Fehler')
    } finally {
      setIsLoadingStats(false)
    }
  }, [activeLibrary])

  // Statistiken beim Laden der Library abrufen
  useEffect(() => {
    if (activeLibrary) {
      loadThumbnailStats()
    }
  }, [activeLibrary, loadThumbnailStats])

  // Thumbnail-Reparatur starten
  const handleRepairThumbnails = useCallback(async () => {
    if (!activeLibrary || isRepairingThumbnails) return

    setIsRepairingThumbnails(true)
    setRepairProgress(0)
    setRepairTotal(thumbnailStats?.missingThumbnails || 0)

    try {
      const response = await fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Fehler: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Kein Stream-Reader verfügbar')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'progress') {
                setRepairProgress(event.current)
                setRepairTotal(event.total)

                if (event.status === 'completed') {
                  toast({
                    title: 'Reparatur abgeschlossen',
                    description: event.message || `${event.total} Thumbnails verarbeitet`,
                  })
                  loadThumbnailStats()
                }
              } else if (event.type === 'error') {
                console.error('Reparatur-Fehler:', event.error)
              }
            } catch (err) {
              // H7-Fix: SSE-Event JSON-Parse-Fehler — defensives Fallback, kein User-Impact
              console.debug('[ChatForm] SSE-Event JSON-Parse-Fehler (Reparatur):', err)
            }
          }
        }
      }
    } catch (error) {
      console.error('Fehler bei der Thumbnail-Reparatur:', error)
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setIsRepairingThumbnails(false)
    }
  }, [activeLibrary, isRepairingThumbnails, thumbnailStats?.missingThumbnails, loadThumbnailStats])

  // Thumbnail-Regenerierung starten
  const handleRegenerateThumbnails = useCallback(async () => {
    if (!activeLibrary || isRegeneratingThumbnails) return

    setIsRegeneratingThumbnails(true)
    setRegenerateProgress(0)
    setRegenerateTotal(thumbnailStats?.withCoverImage || 0)

    try {
      const response = await fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails?regenerate=true`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Fehler: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'progress') {
                  setRegenerateProgress(event.current || 0)
                  setRegenerateTotal(event.total || 0)
                } else if (event.type === 'complete') {
                  toast({
                    title: 'Regenerierung abgeschlossen',
                    description: event.message || `${event.total} Thumbnails neu berechnet`,
                  })
                  loadThumbnailStats()
                }
              } catch (err) {
                // H8-Fix: SSE-Event JSON-Parse-Fehler — defensives Fallback, kein User-Impact
                console.debug('[ChatForm] SSE-Event JSON-Parse-Fehler (Regenerierung):', err)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Fehler bei der Thumbnail-Regenerierung:', error)
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setIsRegeneratingThumbnails(false)
    }
  }, [activeLibrary, isRegeneratingThumbnails, thumbnailStats?.withCoverImage, loadThumbnailStats])

  // Variant-Reparatur starten
  const handleRepairVariants = useCallback(async () => {
    if (!activeLibrary || isRepairingVariants) return

    setIsRepairingVariants(true)

    try {
      const response = await fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails?type=variants`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Fehler: ${response.status}`)
      }

      const result = await response.json()

      toast({
        title: 'Variant-Reparatur abgeschlossen',
        description: `${result.repairedOriginals} Originals, ${result.repairedThumbnails} Thumbnails repariert`,
      })

      loadThumbnailStats()
    } catch (error) {
      console.error('Fehler bei der Variant-Reparatur:', error)
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setIsRepairingVariants(false)
    }
  }, [activeLibrary, isRepairingVariants, loadThumbnailStats])

  // Formular absenden
  async function onSubmit(data: ChatFormValues) {
    console.log('[ChatForm] ✅ onSubmit wurde aufgerufen!')

    setIsLoading(true)
    try {
      if (!activeLibrary) throw new Error(t('settings.chatForm.noLibrarySelected'))

      const {
        ingestionStorageUseCustom,
        ingestionConnectionString,
        ingestionContainerName,
        ...chatFormRest
      } = data

      const chatConfig = {
        ...chatFormRest,
        models: data.chatLlmModel?.trim()
          ? { ...activeLibrary.config?.chat?.models, chat: data.chatLlmModel.trim() }
          : activeLibrary.config?.chat?.models,
      }
      delete (chatConfig as Record<string, unknown>).chatLlmModel

      const ingestionStorage = {
        useCustomConfig: ingestionStorageUseCustom ?? false,
        connectionString:
          ingestionConnectionString ||
          activeLibrary.config?.ingestionStorage?.connectionString ||
          '',
        containerName:
          ingestionContainerName ||
          activeLibrary.config?.ingestionStorage?.containerName ||
          '',
      }

      const response = await fetch(`/api/libraries/${encodeURIComponent(activeLibrary.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeLibrary.id,
          config: { chat: chatConfig, ingestionStorage },
        }),
      })
      const respJson = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`${t('settings.chatForm.errorSaving')} ${respJson?.error || response.statusText}`)

      const updatedLibraries = libraries.map(lib => lib.id === activeLibrary.id
        ? { ...lib, config: { ...lib.config, chat: chatConfig, ingestionStorage } }
        : lib)
      setLibraries(updatedLibraries)

      toast({ title: t('settings.chatForm.saved'), description: `Library: ${activeLibrary.label}` })

      // Prüfe ob Array-Facetten vorhanden sind oder geändert wurden
      const newFacets = data.gallery?.facets || []
      const hasArrayFacets = newFacets.some((f: { type?: string }) => f.type === 'string[]')

      const arrayFacetsChanged = hasArrayFacets && (
        initialFacets.length !== newFacets.length ||
        newFacets.some((f: { metaKey?: string; type?: string }, idx: number) => {
          const oldFacet = initialFacets[idx]
          return !oldFacet || oldFacet.metaKey !== f.metaKey || oldFacet.type !== f.type
        })
      )

      if (hasArrayFacets || arrayFacetsChanged) {
        try {
          const libraryForIndex = {
            ...activeLibrary,
            transcription: (activeLibrary as unknown as Library).transcription || { provider: 'local' as const, enabled: false },
          } as Library
          const indexDef = buildVectorSearchIndexDefinitionForLibrary(libraryForIndex)
          const collection = getCollectionNameForLibrary(libraryForIndex)

          setCollectionName(collection)
          setIndexDefinition(JSON.stringify(indexDef, null, 2))
          setShowIndexDialog(true)
        } catch (error) {
          console.error('Fehler beim Generieren der Index-Definition:', error)
        }
      }
    } catch (error) {
      console.error('Fehler beim Speichern der Chat-Einstellungen:', error)
      toast({
        title: t('settings.chatForm.error'),
        description: error instanceof Error ? error.message : t('settings.chatForm.unknownError'),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    form,
    activeLibrary,
    isLoading,
    showIndexDialog,
    setShowIndexDialog,
    showSearchIndexDialog,
    setShowSearchIndexDialog,
    indexDefinition,
    collectionName,
    initialFacets,
    thumbnailStats,
    isRepairingThumbnails,
    repairProgress,
    repairTotal,
    isRegeneratingThumbnails,
    regenerateProgress,
    regenerateTotal,
    variantStats,
    isRepairingVariants,
    isLoadingStats,
    statsError,
    healthResult,
    healthError,
    azureIngestionCustom,
    azureContainerWatched,
    defaultEmbeddings,
    loadThumbnailStats,
    handleRepairThumbnails,
    handleRegenerateThumbnails,
    handleRepairVariants,
    onSubmit,
  }
}
