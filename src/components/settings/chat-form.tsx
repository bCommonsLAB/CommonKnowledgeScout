"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useEffect, useState, useCallback } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Button } from "@/components/ui/button"
import { Cloud, Wrench, Loader2, RefreshCw } from "lucide-react"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { FacetDefsEditor } from '@/components/settings/FacetDefsEditor'
import { IndexDefinitionDialog } from '@/components/settings/index-definition-dialog'
import { SearchIndexDialog } from '@/components/settings/search-index-dialog'
import { buildVectorSearchIndexDefinitionForLibrary, getCollectionNameForLibrary } from '@/lib/chat/vector-search-index'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TARGET_LANGUAGE_ZOD_ENUM,
  TARGET_LANGUAGE_DEFAULT,
  TARGET_LANGUAGE_VALUES,
  CHARACTER_ARRAY_ZOD_SCHEMA,
  CHARACTER_DEFAULT,
  CHARACTER_VALUES,
  SOCIAL_CONTEXT_ZOD_ENUM,
  SOCIAL_CONTEXT_DEFAULT,
  SOCIAL_CONTEXT_VALUES,
  isValidSocialContext,
  isValidCharacterArray,
  isValidTargetLanguage,
  normalizeCharacterToArray,
  type Character,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import { useStoryContext } from '@/hooks/use-story-context'
import type { Library } from '@/types/library'
import { getDefaultFacets, getDefaultEmbeddings } from '@/lib/chat/config'
import { LlmModelSelector } from "@/components/ui/llm-model-selector"

// Zod-Schema für Chat-Konfiguration
const chatFormSchema = z.object({
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
      z.enum(['book', 'session', 'climateAction', 'testimonial', 'blog']).default('book')
    ),
    // Gruppierung: 'none' = keine, 'year' = nach Jahr, oder ein Facetten-Key (z.B. 'category')
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
    })).default(getDefaultFacets().slice(0, 6)) // Nur die ersten 6 sichtbaren Facetten als Default
  }).optional(),
})

type ChatFormValues = z.infer<typeof chatFormSchema>

export function ChatForm() {
  const { t } = useTranslation()
  const { targetLanguageLabels, characterLabels, socialContextLabels } = useStoryContext()
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [healthResult] = useState<{
    ok?: boolean;
    indexes?: Array<{ name: string }>;
    expectedIndex?: string;
    expectedIndexName?: string;
    exists?: boolean;
    status?: number | { state?: string };
    error?: string;
    vectorCount?: number;
    dimension?: number;
  } | null>(null)
  const [healthError] = useState<string | null>(null)
  const [showIndexDialog, setShowIndexDialog] = useState(false)
  const [showSearchIndexDialog, setShowSearchIndexDialog] = useState(false)
  const [indexDefinition, setIndexDefinition] = useState<string>('')
  const [collectionName, setCollectionName] = useState<string>('')
  const [initialFacets, setInitialFacets] = useState<Array<{ metaKey: string; type?: string }>>([])
  
  // Thumbnail-Reparatur States
  const [thumbnailStats, setThumbnailStats] = useState<{
    total?: number
    withCoverImage?: number
    missingThumbnails?: number
    alreadyRepaired?: number
  } | null>(null)
  const [isRepairingThumbnails, setIsRepairingThumbnails] = useState(false)
  const [repairProgress, setRepairProgress] = useState(0)
  const [repairTotal, setRepairTotal] = useState(0)
  
  // Thumbnail-Regenerierung States (alle Thumbnails mit neuer Größe neu berechnen)
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false)
  const [regenerateProgress, setRegenerateProgress] = useState(0)
  const [regenerateTotal, setRegenerateTotal] = useState(0)
  
  // Variant-Reparatur States
  const [variantStats, setVariantStats] = useState<{
    total?: number
    missingVariant?: number
    alreadyCorrect?: number
  } | null>(null)
  const [isRepairingVariants, setIsRepairingVariants] = useState(false)
  
  // Loading-State für Statistiken
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)

  // Hole Default-Embeddings aus zentralem Schema
  const defaultEmbeddings = getDefaultEmbeddings()

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatFormSchema),
    mode: 'onChange', // Echtzeit-Validierung aktivieren
    defaultValues: {
      placeholder: t('settings.chatForm.placeholderDefault'),
      maxChars: 500,
      maxCharsWarningMessage: t('settings.chatForm.maxCharsWarningDefault'),
      footerText: "",
      companyLink: "",
      embeddings: defaultEmbeddings, // Verwende Defaults aus zentralem Schema
      targetLanguage: TARGET_LANGUAGE_DEFAULT,
      character: CHARACTER_DEFAULT,
      socialContext: SOCIAL_CONTEXT_DEFAULT,
gallery: {
        detailViewType: 'book',
        groupByField: 'year', // Default: Nach Jahr gruppieren
        facets: getDefaultFacets().slice(0, 6) // Nur die ersten 6 sichtbaren Facetten als Default
      },
    },
  })

  useEffect(() => {
    if (activeLibrary?.config?.chat) {
      const c = activeLibrary.config.chat as unknown as Record<string, unknown>
      
      // Debug: Zeige VOLLSTÄNDIGE geladene Library
      console.log('[ChatForm] ===== LIBRARY LADEN START =====');
      console.log('[ChatForm] Active Library ID:', activeLibrary.id);
      console.log('[ChatForm] Active Library Label:', activeLibrary.label);
      console.log('[ChatForm] Full Config.Chat:', JSON.stringify(c, null, 2));
      console.log('[ChatForm] Neue Chat-Config-Felder:', {
        targetLanguage: c.targetLanguage,
        character: c.character,
        socialContext: c.socialContext,
      });
      
      // Debug: Zeige geladene Config
      console.log('[ChatForm] Lade Config aus Library:', {
        libraryId: activeLibrary.id,
        galleryConfig: JSON.stringify(c.gallery),
        detailViewType: (c.gallery as { detailViewType?: unknown })?.detailViewType
      })
      
      const galleryConfig = c.gallery as { detailViewType?: unknown; groupByField?: string; facets?: unknown } | undefined
      const detailViewType = galleryConfig?.detailViewType
      
      // Explizite Prüfung und Logging - alle gültigen Typen akzeptieren
      const validDetailViewTypes = ['book', 'session', 'climateAction', 'testimonial', 'blog'] as const
      type DetailViewType = typeof validDetailViewTypes[number]
      let finalViewType: DetailViewType = 'book'
      if (typeof detailViewType === 'string' && validDetailViewTypes.includes(detailViewType as DetailViewType)) {
        finalViewType = detailViewType as DetailViewType
        console.log('[ChatForm] ✅ Setze detailViewType auf:', finalViewType)
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter detailViewType:', detailViewType, '- verwende default: book')
      }
      
      // Explizite Prüfung für targetLanguage
      let finalTargetLanguage: typeof TARGET_LANGUAGE_DEFAULT = TARGET_LANGUAGE_DEFAULT
      const targetLanguageVal = c.targetLanguage
      if (isValidTargetLanguage(targetLanguageVal)) {
        finalTargetLanguage = targetLanguageVal
        console.log('[ChatForm] ✅ Setze targetLanguage auf:', finalTargetLanguage)
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter targetLanguage:', targetLanguageVal, '- verwende default:', TARGET_LANGUAGE_DEFAULT)
      }
      
      // Explizite Prüfung für character (Array)
      let finalCharacter: Character[] = CHARACTER_DEFAULT
      const characterVal = c.character
      if (isValidCharacterArray(characterVal)) {
        finalCharacter = characterVal
        console.log('[ChatForm] ✅ Setze character auf:', finalCharacter)
      } else {
        // Normalisiere zu Array (für Backward-Compatibility)
        finalCharacter = normalizeCharacterToArray(characterVal)
        console.log('[ChatForm] ⚠️ Character normalisiert:', characterVal, '->', finalCharacter)
      }
      
      // Explizite Prüfung für socialContext
      let finalSocialContext: typeof SOCIAL_CONTEXT_DEFAULT = SOCIAL_CONTEXT_DEFAULT
      const socialContextVal = c.socialContext
      if (isValidSocialContext(socialContextVal)) {
        finalSocialContext = socialContextVal
        console.log('[ChatForm] ✅ Setze socialContext auf:', finalSocialContext)
      } else {
        console.log('[ChatForm] ⚠️ Unbekannter socialContext:', socialContextVal, '- verwende default:', SOCIAL_CONTEXT_DEFAULT)
      }
      
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
        // Standard-LLM-Modell für Chat-Antworten
        chatLlmModel: typeof (c.models as { chat?: string })?.chat === 'string' 
          ? (c.models as { chat: string }).chat 
          : '',
        targetLanguage: finalTargetLanguage,
        character: finalCharacter,
        socialContext: finalSocialContext,
        gallery: {
          detailViewType: finalViewType,
          // Gruppierung: Lade aus Config oder Default 'year'
          groupByField: typeof galleryConfig?.groupByField === 'string' && galleryConfig.groupByField.length > 0 
            ? galleryConfig.groupByField 
            : 'year',
          facets: (() => {
            const raw = galleryConfig?.facets
            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') return raw as Array<Record<string, unknown>>
            if (Array.isArray(raw)) {
              // Legacy-Format: Array von Strings -> konvertiere zu Facetten-Objekten
              const defaultFacetsMap = new Map(getDefaultFacets().map(f => [f.metaKey, f]))
              return (raw as Array<unknown>).map(v => String(v)).filter(Boolean).map((k) => {
                const defaultFacet = defaultFacetsMap.get(k)
                return defaultFacet || { metaKey: k, label: k, type: 'string', multi: true, visible: true, showInTable: false }
              })
            }
            // Fallback: Verwende zentrale Default-Facetten
            return getDefaultFacets().slice(0, 6) // Nur die ersten 6 sichtbaren Facetten
          })(),
        },
      })
      
      // Speichere initiale Facetten für Vergleich
      const facets = form.getValues('gallery.facets') || []
      setInitialFacets(facets.map((f: { metaKey?: string; type?: string }) => ({
        metaKey: f.metaKey || '',
        type: f.type,
      })))
      
      // Nach dem Reset nochmal prüfen
      const afterResetValue = form.getValues('gallery.detailViewType')
      const afterResetGroupBy = form.getValues('gallery.groupByField')
      console.log('[ChatForm] Form nach reset:', {
        detailViewType: afterResetValue,
        groupByField: afterResetGroupBy,
        groupByFieldFromConfig: galleryConfig?.groupByField,
        allGalleryValues: form.getValues('gallery')
      })
    }
  }, [activeLibrary, form, t, defaultEmbeddings.chunkOverlap, defaultEmbeddings.chunkSize, defaultEmbeddings.dimensions, defaultEmbeddings.embeddingModel])

  // Thumbnail- und Variant-Statistiken laden
  const loadThumbnailStats = useCallback(async () => {
    if (!activeLibrary) return
    
    setIsLoadingStats(true)
    setStatsError(null)
    
    try {
      // Thumbnail-Statistik
      const thumbResponse = await fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails`)
      if (thumbResponse.ok) {
        const data = await thumbResponse.json()
        setThumbnailStats(data)
      } else {
        const errorData = await thumbResponse.json().catch(() => ({}))
        setStatsError(`Fehler beim Laden: ${errorData.error || thumbResponse.status}`)
      }
      
      // Variant-Statistik (parallel laden)
      const variantResponse = await fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails?type=variants`)
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
      
      // SSE-Stream verarbeiten
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
        
        // Verarbeite SSE-Events
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Letzte unvollständige Zeile behalten
        
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
                  // Statistiken aktualisieren
                  loadThumbnailStats()
                }
              } else if (event.type === 'error') {
                console.error('Reparatur-Fehler:', event.error)
              }
            } catch {
              // JSON-Parse-Fehler ignorieren
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
  
  // Thumbnail-Regenerierung starten (ALLE Thumbnails mit neuer Größe neu berechnen)
  const handleRegenerateThumbnails = useCallback(async () => {
    if (!activeLibrary || isRegeneratingThumbnails) return
    
    setIsRegeneratingThumbnails(true)
    setRegenerateProgress(0)
    setRegenerateTotal(thumbnailStats?.withCoverImage || 0)
    
    try {
      // Regenerate-Modus: Alle Thumbnails neu berechnen (nicht nur fehlende)
      const response = await fetch(`/api/library/${encodeURIComponent(activeLibrary.id)}/repair-thumbnails?regenerate=true`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`Fehler: ${response.status}`)
      }
      
      // SSE-Stream verarbeiten
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
                  // Statistiken aktualisieren
                  loadThumbnailStats()
                }
              } catch {
                // Parsing-Fehler ignorieren
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
  
  // Variant-Reparatur starten (synchron, schnell)
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
      
      // Statistiken aktualisieren
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

  async function onSubmit(data: ChatFormValues) {
    console.log('[ChatForm] ✅ onSubmit wurde aufgerufen!')
    console.log('[ChatForm] Form Errors:', form.formState.errors)
    console.log('[ChatForm] Form isValid:', form.formState.isValid)
    
    setIsLoading(true)
    try {
      if (!activeLibrary) throw new Error(t('settings.chatForm.noLibrarySelected'))

      // Debug-Output vor dem Speichern
      // eslint-disable-next-line no-console
      console.log('[ChatForm] Speichere Chat-Config …', { 
        libraryId: activeLibrary.id, 
        facets: data.gallery?.facets?.length || 0,
        detailViewType: data.gallery?.detailViewType,
        fullGallery: data.gallery 
      })

      // Chat-Config vorbereiten: chatLlmModel → models.chat transformieren
      const chatConfig = {
        ...data,
        // chatLlmModel als models.chat speichern (falls gesetzt)
        models: data.chatLlmModel?.trim() 
          ? { ...activeLibrary.config?.chat?.models, chat: data.chatLlmModel.trim() }
          : activeLibrary.config?.chat?.models,
      }
      // chatLlmModel aus dem gesendeten Objekt entfernen (ist jetzt unter models.chat)
      delete (chatConfig as Record<string, unknown>).chatLlmModel

      // Nur Chat-Config mergen, Server behält restliche Config sicher bei
      const response = await fetch(`/api/libraries/${encodeURIComponent(activeLibrary.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeLibrary.id, config: { chat: chatConfig } }),
      })
      const respJson = await response.json().catch(() => ({}))
      // eslint-disable-next-line no-console
      console.log('[ChatForm] PATCH response', { status: response.status, body: respJson })
      if (!response.ok) throw new Error(`${t('settings.chatForm.errorSaving')} ${respJson?.error || response.statusText}`)

      const updatedLibraries = libraries.map(lib => lib.id === activeLibrary.id
        ? { ...lib, config: { ...lib.config, chat: chatConfig } }
        : lib)
      setLibraries(updatedLibraries)

      toast({ title: t('settings.chatForm.saved'), description: `Library: ${activeLibrary.label}` })

      // Prüfe ob Array-Facetten vorhanden sind oder geändert wurden
      const newFacets = data.gallery?.facets || []
      const hasArrayFacets = newFacets.some((f: { type?: string }) => f.type === 'string[]')
      
      // Vergleiche mit initialen Facetten
      const arrayFacetsChanged = hasArrayFacets && (
        initialFacets.length !== newFacets.length ||
        newFacets.some((f: { metaKey?: string; type?: string }, idx: number) => {
          const oldFacet = initialFacets[idx]
          return !oldFacet || oldFacet.metaKey !== f.metaKey || oldFacet.type !== f.type
        })
      )

      if (hasArrayFacets || arrayFacetsChanged) {
        // Generiere Index-Definition
        try {
          // Konvertiere ClientLibrary zu Library für buildVectorSearchIndexDefinition
          // (buildVectorSearchIndexDefinition benötigt Library, nicht ClientLibrary)
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

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">{t('settings.chatForm.selectLibrary')}</div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* ===== Chat UI ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Chat UI</h3>
            <p className="text-sm text-muted-foreground">
              Einstellungen für die Darstellung des Chat-Eingabefelds.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="placeholder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.placeholder')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('settings.chatForm.placeholderDefault')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxChars"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.maxChars')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={4000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="maxCharsWarningMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settings.chatForm.maxCharsWarning')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('settings.chatForm.maxCharsWarningDefault')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="footerText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.footerText')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('settings.chatForm.footerTextPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.footerLink')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('settings.chatForm.footerLinkPlaceholder')} {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ===== RAG Konfiguration ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">RAG Konfiguration</h3>
            <p className="text-sm text-muted-foreground">
              Einstellungen für die Vektorsuche und Dokumenten-Chunking.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="embeddings.embeddingModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Embedding Modell</FormLabel>
                  <FormControl>
                    <Input placeholder="voyage-3-large" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Embedding-Modell (z.B. voyage-3-large, text-embedding-3-large)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="embeddings.dimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dimension</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder={String(defaultEmbeddings.dimensions)} 
                      {...field} 
                      value={field.value || ""}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val ? parseInt(val, 10) : undefined)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Embedding-Dimension ({defaultEmbeddings.dimensions} für voyage-3-large, 3072 für text-embedding-3-large)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="embeddings.chunkSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chunk Größe</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="1000" 
                      {...field} 
                      value={field.value || ""}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val ? parseInt(val, 10) : undefined)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Chunk-Größe in Zeichen (Standard: 1000)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="embeddings.chunkOverlap"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chunk Overlap</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="200" 
                      {...field} 
                      value={field.value || ""}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val ? parseInt(val, 10) : undefined)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Chunk-Overlap in Zeichen (Standard: 200)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ===== Eigene Perspektive ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Eigene Perspektive</h3>
            <p className="text-sm text-muted-foreground">
              LLM-Einstellungen und Perspektive für Chat-Antworten.
            </p>
          </div>

          {/* LLM-Modell für Chat-Antworten */}
          <FormField
            control={form.control}
            name="chatLlmModel"
            render={({ field }) => (
              <FormItem>
                <LlmModelSelector
                  value={field.value || ''}
                  onChange={(v) => field.onChange(v)}
                  label="LLM-Modell"
                  placeholder="(kein Default)"
                  description="Standard-LLM-Modell für Chat-Antworten."
                  variant="form"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="targetLanguage"
              render={({ field }) => {
                const currentValue = field.value || TARGET_LANGUAGE_DEFAULT
                return (
                  <FormItem>
                    <FormLabel>{t('settings.chatForm.targetLanguage')}</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (TARGET_LANGUAGE_VALUES.includes(value as typeof TARGET_LANGUAGE_VALUES[number])) {
                        field.onChange(value)
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TARGET_LANGUAGE_VALUES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {targetLanguageLabels[lang]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('settings.chatForm.targetLanguageDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="character"
              render={({ field }) => {
                // field.value ist jetzt ein Array, nimm den ersten Wert für das Select
                const characterArray = Array.isArray(field.value) && field.value.length > 0 
                  ? field.value 
                  : CHARACTER_DEFAULT
                const currentValue = characterArray[0] || CHARACTER_DEFAULT[0]
                return (
                  <FormItem>
                    <FormLabel>{t('settings.chatForm.character')}</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (CHARACTER_VALUES.includes(value as typeof CHARACTER_VALUES[number])) {
                        // Konvertiere zu Array mit einem Wert
                        field.onChange([value])
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CHARACTER_VALUES.map((char) => (
                          <SelectItem key={char} value={char}>
                            {characterLabels[char]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('settings.chatForm.characterDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="socialContext"
              render={({ field }) => {
                const currentValue = field.value || SOCIAL_CONTEXT_DEFAULT
                return (
                  <FormItem>
                    <FormLabel>{t('settings.chatForm.socialContext')}</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (SOCIAL_CONTEXT_VALUES.includes(value as typeof SOCIAL_CONTEXT_VALUES[number])) {
                        field.onChange(value)
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SOCIAL_CONTEXT_VALUES.map((ctx) => (
                          <SelectItem key={ctx} value={ctx}>
                            {socialContextLabels[ctx]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('settings.chatForm.socialContextDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
          </div>
        </div>

        {/* ===== Wissensgalerie ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Wissensgalerie</h3>
            <p className="text-sm text-muted-foreground">
              Einstellungen für die Darstellung der Wissensgalerie.
            </p>
          </div>
          <FormField
            control={form.control}
            name="gallery.detailViewType"
            render={({ field }) => {
              const currentValue = field.value || 'book';
              console.log('[ChatForm] Select Field Render:', { fieldValue: field.value, currentValue });
              
              return (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.galleryDetailViewType')}</FormLabel>
                  <Select 
                    value={currentValue} 
                    onValueChange={(value) => {
                      console.log('[ChatForm] Select onChange:', value);
                      // NUR valide Werte akzeptieren (leere Strings ignorieren!)
                      if (value === 'book' || value === 'session' || value === 'climateAction' || value === 'testimonial' || value === 'blog') {
                        field.onChange(value);
                      } else {
                        console.warn('[ChatForm] Ungültiger detailViewType ignoriert:', value);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="book">{t('settings.chatForm.detailViewTypeBook')}</SelectItem>
                      <SelectItem value="session">{t('settings.chatForm.detailViewTypeSession')}</SelectItem>
                      <SelectItem value="climateAction">{t('settings.chatForm.detailViewTypeClimateAction')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('settings.chatForm.galleryDetailViewTypeDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Gruppierung der Galerie-Items */}
          <FormField
            control={form.control}
            name="gallery.groupByField"
            render={({ field }) => {
              const currentValue = field.value || 'year';
              const facets = form.watch("gallery.facets") || [];
              // Nur String-Facetten mit gültigem metaKey als Gruppierungsoptionen anbieten
              const stringFacets = facets.filter((f: { type?: string; metaKey?: string }) => 
                f.type === 'string' && f.metaKey && f.metaKey.length > 0
              );
              
              console.log('[ChatForm] GroupBy Select Render:', { 
                fieldValue: field.value, 
                currentValue, 
                stringFacetKeys: stringFacets.map((f: { metaKey: string }) => f.metaKey)
              });
              
              return (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.galleryGroupBy')}</FormLabel>
                  <Select 
                    value={currentValue} 
                    onValueChange={(value) => {
                      // Ignoriere leere Werte (Radix UI Bug bei Initialisierung)
                      if (!value || value === '') {
                        console.log('[ChatForm] Leerer groupByField ignoriert');
                        return;
                      }
                      console.log('[ChatForm] groupByField onChange:', value);
                      field.onChange(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('settings.chatForm.groupByNone')}</SelectItem>
                      <SelectItem value="year">{t('settings.chatForm.groupByYear')}</SelectItem>
                      {/* Dynamisch alle String-Facetten als Gruppierungsoptionen */}
                      {stringFacets.map((facet: { metaKey: string; label?: string }) => (
                        <SelectItem key={facet.metaKey} value={facet.metaKey}>
                          {facet.label || facet.metaKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('settings.chatForm.galleryGroupByDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <div className="grid gap-3">
            <FormLabel>{t('settings.chatForm.galleryFacets')}</FormLabel>
            <FormDescription>{t('settings.chatForm.galleryFacetsDescription')}</FormDescription>
            <FacetDefsEditor 
              value={form.watch("gallery.facets") || []} 
              onChange={(v) => form.setValue("gallery.facets", v, { shouldDirty: true })} 
              detailViewType={form.watch("gallery.detailViewType")}
            />
          </div>
        </div>

        {/* ===== Binary Storage ===== */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Binary Storage</h3>
            <p className="text-sm text-muted-foreground">
              Speicherort für Bilder und andere Binärdateien.
            </p>
          </div>
          
          {/* Informative Anzeige */}
          <div className="rounded-md border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <Cloud className="h-4 w-4" />
              <span className="font-medium">Azure Blob Storage</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Container: knowledgescout / {activeLibrary?.id || '...'}
            </p>
          </div>
          
          {/* Thumbnail-Statistik */}
          {isLoadingStats ? (
            <div className="rounded-md border p-4 bg-muted/30 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Lade Statistik...</p>
            </div>
          ) : statsError ? (
            <div className="rounded-md border p-4 bg-destructive/10 text-center">
              <p className="text-sm text-destructive">{statsError}</p>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={loadThumbnailStats}
              >
                Erneut versuchen
              </Button>
            </div>
          ) : thumbnailStats ? (
            <div className="rounded-md border p-4 bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{thumbnailStats.total ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">Shadow-Twins</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{thumbnailStats.withCoverImage ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">mit Cover-Bild</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{thumbnailStats.missingThumbnails ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">fehlende Thumbnails</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{thumbnailStats.alreadyRepaired ?? '-'}</div>
                  <div className="text-xs text-muted-foreground">repariert</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border p-4 bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Keine Statistik verfügbar</p>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={loadThumbnailStats}
              >
                Statistik laden
              </Button>
            </div>
          )}
          
          {/* Thumbnail-Reparatur-Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Thumbnails reparieren</p>
              <p className="text-xs text-muted-foreground">
                Generiert fehlende Thumbnails für alle Cover-Bilder.
              </p>
            </div>
            <Button 
              type="button"
              variant="outline" 
              onClick={handleRepairThumbnails}
              disabled={isRepairingThumbnails || isRegeneratingThumbnails || (thumbnailStats?.missingThumbnails ?? 0) === 0}
            >
              {isRepairingThumbnails ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Repariere... ({repairProgress}/{repairTotal})
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Thumbnails reparieren
                </>
              )}
            </Button>
          </div>
          
          {/* Thumbnail-Regenerierung-Button (alle mit neuer Größe neu berechnen) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Thumbnails neu berechnen</p>
              <p className="text-xs text-muted-foreground">
                Regeneriert alle Thumbnails mit der aktuellen Größe (640×640px).
              </p>
            </div>
            <Button 
              type="button"
              variant="outline" 
              onClick={handleRegenerateThumbnails}
              disabled={isRepairingThumbnails || isRegeneratingThumbnails || (thumbnailStats?.withCoverImage ?? 0) === 0}
            >
              {isRegeneratingThumbnails ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Berechne... ({regenerateProgress}/{regenerateTotal})
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Thumbnails neu berechnen
                </>
              )}
            </Button>
          </div>
          
          {/* Variant-Statistik und Reparatur */}
          {variantStats && (variantStats.missingVariant ?? 0) > 0 && (
            <div className="rounded-md border p-4 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Metadaten-Reparatur erforderlich
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {variantStats.missingVariant ?? 0} Fragment(e) ohne Typ-Markierung gefunden.
                  </p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={handleRepairVariants}
                  disabled={isRepairingVariants}
                >
                  {isRepairingVariants ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Wrench className="h-4 w-4 mr-2" />
                      Metadaten reparieren
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              if (activeLibrary) {
                setShowSearchIndexDialog(true)
              } else {
                toast({ 
                  title: t('settings.chatForm.error'),
                  description: t('settings.chatForm.noLibrarySelected'),
                  variant: 'destructive'
                })
              }
            }}
          >
            SearchIndex
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            onClick={() => {
              console.log('[ChatForm] Button wurde geklickt!')
              console.log('[ChatForm] Form State:', {
                isValid: form.formState.isValid,
                isDirty: form.formState.isDirty,
                errors: form.formState.errors,
                values: form.getValues()
              })
            }}
          >
            {isLoading ? t('settings.chatForm.saving') : t('settings.chatForm.save')}
          </Button>
        </div>

        {(healthResult || healthError) && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-2">
              {t('settings.chatForm.indexStatus')}
            </div>
            {healthError ? (
              <div className="text-sm text-destructive">{healthError}</div>
            ) : healthResult?.exists === true ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-green-600 dark:text-green-400">{t('settings.chatForm.indexExists')}</div>
                <div className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">{t('settings.chatForm.index')}</span> {healthResult.expectedIndexName || healthResult.expectedIndex}</div>
                  <div><span className="text-muted-foreground">{t('settings.chatForm.vectors')}</span> {(healthResult.vectorCount || 0).toLocaleString('de-DE')}</div>
                  <div><span className="text-muted-foreground">{t('settings.chatForm.dimension')}</span> {healthResult.dimension}</div>
                  <div><span className="text-muted-foreground">{t('settings.chatForm.status')}</span> {(healthResult as Record<string, unknown>).status ? String((healthResult as Record<string, unknown>).status) : 'Unknown'}</div>
                </div>
              </div>
            ) : healthResult?.exists === false ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">{t('settings.chatForm.indexMissing')}</div>
                <div className="text-xs">
                  <div><span className="text-muted-foreground">{t('settings.chatForm.expectedName')}</span> {healthResult.expectedIndexName || healthResult.expectedIndex}</div>
                  <div className="text-sm text-muted-foreground mt-2">{t('settings.chatForm.indexMissingDescription')}</div>
                </div>
              </div>
            ) : (
              <pre className="text-xs whitespace-pre-wrap break-words">{healthResult ? JSON.stringify(healthResult, null, 2) : ''}</pre>
            )}
          </div>
        )}
      </form>

      {/* Index Definition Dialog */}
      <IndexDefinitionDialog
        open={showIndexDialog}
        onOpenChange={setShowIndexDialog}
        collectionName={collectionName}
        indexDefinition={indexDefinition}
      />
      
      {/* SearchIndex Dialog */}
      {activeLibrary && (
        <SearchIndexDialog
          open={showSearchIndexDialog}
          onOpenChange={setShowSearchIndexDialog}
          libraryId={activeLibrary.id}
        />
      )}
    </Form>
  )
}


