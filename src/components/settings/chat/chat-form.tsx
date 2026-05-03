"use client"

/**
 * ChatForm — Formular für Chat-Einstellungen einer Library.
 *
 * Nutzt useChatForm() für den gesamten State + Handler.
 * Render-Verantwortung: Sections, Formfelder, Buttons.
 *
 * Extrahiert aus src/components/settings/chat-form.tsx (Welle 3-IV-b).
 */

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
import { Switch } from "@/components/ui/switch"
import { FacetDefsEditor } from '@/components/settings/FacetDefsEditor'
import { IndexDefinitionDialog } from '@/components/settings/index-definition-dialog'
import { SearchIndexDialog } from '@/components/settings/search-index-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TARGET_LANGUAGE_DEFAULT,
  TARGET_LANGUAGE_VALUES,
  CHARACTER_DEFAULT,
  CHARACTER_VALUES,
  SOCIAL_CONTEXT_DEFAULT,
  SOCIAL_CONTEXT_VALUES,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import { useStoryContext } from '@/hooks/use-story-context'
import { LlmModelSelector } from "@/components/ui/llm-model-selector"
import { toast } from "@/components/ui/use-toast"
import { useChatForm } from './hooks/use-chat-form'

export function ChatForm() {
  const { t } = useTranslation()
  const { targetLanguageLabels, characterLabels, socialContextLabels } = useStoryContext()

  const {
    form,
    activeLibrary,
    isLoading,
    showIndexDialog,
    setShowIndexDialog,
    showSearchIndexDialog,
    setShowSearchIndexDialog,
    indexDefinition,
    collectionName,
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
  } = useChatForm()

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
                const characterArray = Array.isArray(field.value) && field.value.length > 0
                  ? field.value
                  : CHARACTER_DEFAULT
                const currentValue = characterArray[0] || CHARACTER_DEFAULT[0]
                return (
                  <FormItem>
                    <FormLabel>{t('settings.chatForm.character')}</FormLabel>
                    <Select value={currentValue} onValueChange={(value) => {
                      if (CHARACTER_VALUES.includes(value as typeof CHARACTER_VALUES[number])) {
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
              return (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.galleryDetailViewType')}</FormLabel>
                  <Select
                    value={currentValue}
                    onValueChange={(value) => {
                      if (value === 'book' || value === 'session' || value === 'climateAction' || value === 'testimonial' || value === 'blog' || value === 'divaDocument' || value === 'divaTexture' || value === 'refurbedDevice') {
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
                      <SelectItem value="divaDocument">{t('settings.chatForm.detailViewTypeDivaDocument')}</SelectItem>
                      <SelectItem value="divaTexture">{t('settings.chatForm.detailViewTypeDivaTexture')}</SelectItem>
                      <SelectItem value="refurbedDevice">{t('settings.chatForm.detailViewTypeRefurbedDevice')}</SelectItem>
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

          <FormField
            control={form.control}
            name="gallery.galleryCardDensity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settings.chatForm.galleryCardDensity')}</FormLabel>
                <Select
                  value={field.value || 'comfortable'}
                  onValueChange={(value) => {
                    if (value === 'compact' || value === 'comfortable') {
                      field.onChange(value)
                    } else {
                      console.warn('[ChatForm] Ungültige galleryCardDensity ignoriert:', value)
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="comfortable">{t('settings.chatForm.galleryCardDensityComfortable')}</SelectItem>
                    <SelectItem value="compact">{t('settings.chatForm.galleryCardDensityCompact')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>{t('settings.chatForm.galleryCardDensityDescription')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gallery.groupByField"
            render={({ field }) => {
              const currentValue = field.value || 'year';
              const facets = form.watch("gallery.facets") || [];
              const stringFacets = facets.filter((f: { type?: string; metaKey?: string }) =>
                f.type === 'string' && f.metaKey && f.metaKey.length > 0
              );

              return (
                <FormItem>
                  <FormLabel>{t('settings.chatForm.galleryGroupBy')}</FormLabel>
                  <Select
                    value={currentValue}
                    onValueChange={(value) => {
                      if (!value || value === '') {
                        return;
                      }
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
              Speicherort für Bilder und andere Binärdateien (Azure Blob bei Ingestion). Optional eigene Zugangsdaten pro Bibliothek — sonst gelten{' '}
              <code className="text-xs">AZURE_STORAGE_*</code>-Umgebungsvariablen.
            </p>
          </div>

          <FormField
            control={form.control}
            name="ingestionStorageUseCustom"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Bibliothekseigene Azure-Zugangsdaten</FormLabel>
                  <FormDescription>
                    {field.value
                      ? 'Connection String und Container werden in MongoDB für diese Bibliothek gespeichert.'
                      : 'Globale Azure-Konfiguration aus der Prozess-Umgebung verwenden.'}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {azureIngestionCustom && (
            <>
              <FormField
                control={form.control}
                name="ingestionConnectionString"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Azure Connection String</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="DefaultEndpointsProtocol=https;AccountName=…"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        autoComplete="new-password"
                        name="azure-ingestion-conn"
                        spellCheck={false}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Nur serverseitig. Leer lassen, um den gespeicherten Wert beizubehalten.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ingestionContainerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container-Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z. B. knowledgescout"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Kurzüberblick zur aktuellen Auflösung */}
          <div className="rounded-md border p-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <Cloud className="h-4 w-4" />
              <span className="font-medium">Azure Blob Storage</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {azureIngestionCustom ? (
                <>
                  Container (Bibliothek):{' '}
                  <span className="font-mono">{azureContainerWatched.trim() || '…'}</span>
                  {' · '}Blob-Pfad enthält Library-ID: <span className="font-mono">{activeLibrary.id}</span>
                </>
              ) : (
                <>
                  Container aus <span className="font-mono">AZURE_STORAGE_CONTAINER_NAME</span> (Umgebung)
                  {' · '}Unterordner u. a. <span className="font-mono">{activeLibrary.id}</span>
                </>
              )}
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

          {/* Thumbnail-Reparatur */}
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

          {/* Thumbnail-Regenerierung */}
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
            ) : (healthResult as { exists?: boolean } | null)?.exists === true ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-green-600 dark:text-green-400">{t('settings.chatForm.indexExists')}</div>
                <div className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">{t('settings.chatForm.index')}</span> {String((healthResult as Record<string, unknown>).expectedIndexName || (healthResult as Record<string, unknown>).expectedIndex || '')}</div>
                  <div><span className="text-muted-foreground">{t('settings.chatForm.vectors')}</span> {(((healthResult as Record<string, unknown>).vectorCount as number) || 0).toLocaleString('de-DE')}</div>
                  <div><span className="text-muted-foreground">{t('settings.chatForm.dimension')}</span> {String((healthResult as Record<string, unknown>).dimension || '')}</div>
                  <div><span className="text-muted-foreground">{t('settings.chatForm.status')}</span> {(healthResult as Record<string, unknown>).status ? String((healthResult as Record<string, unknown>).status) : 'Unknown'}</div>
                </div>
              </div>
            ) : (healthResult as { exists?: boolean } | null)?.exists === false ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">{t('settings.chatForm.indexMissing')}</div>
                <div className="text-xs">
                  <div><span className="text-muted-foreground">{t('settings.chatForm.expectedName')}</span> {String((healthResult as Record<string, unknown>).expectedIndexName || (healthResult as Record<string, unknown>).expectedIndex || '')}</div>
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
