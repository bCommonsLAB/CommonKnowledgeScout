"use client"

/**
 * ChatForm — Formular für Chat-Einstellungen einer Library.
 *
 * Nutzt useChatForm() für den gesamten State + Handler.
 * Render-Verantwortung: Sections, Formfelder, Buttons.
 *
 * Extrahiert aus src/components/settings/chat-form.tsx (Welle 3-IV-b).
 * Sections-Split in Welle 3-IV-Settings-Sections:
 * - RetrievalConfigSection  (RAG Konfiguration)
 * - ModelConfigSection      (Eigene Perspektive: LLM, Sprache, Charakter)
 * - GalleryConfigSection    (Wissensgalerie)
 * - BinaryStorageSection    (Azure Blob + Thumbnails)
 */

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { IndexDefinitionDialog } from '@/components/settings/index-definition-dialog'
import { SearchIndexDialog } from '@/components/settings/search-index-dialog'
import { useTranslation } from '@/lib/i18n/hooks'
import { toast } from "@/components/ui/use-toast"
import { useChatForm } from './hooks/use-chat-form'
// Hinweis: useStoryContext wird nicht mehr in chat-form.tsx benötigt,
// da ModelConfigSection diesen Hook intern verwendet.
import { RetrievalConfigSection } from './retrieval-config-section'
import { ModelConfigSection } from './model-config-section'
import { GalleryConfigSection } from './gallery-config-section'
import { GraphConfigSection } from './graph-config-section'
import { BinaryStorageSection } from './binary-storage-section'

export function ChatForm() {
  const { t } = useTranslation()

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

        {/* ===== RAG Konfiguration → RetrievalConfigSection ===== */}
        <RetrievalConfigSection form={form} defaultEmbeddings={defaultEmbeddings} />

        {/* ===== Eigene Perspektive → ModelConfigSection ===== */}
        <ModelConfigSection form={form} />

                {/* ===== Wissensgalerie → GalleryConfigSection ===== */}
        <GalleryConfigSection form={form} />

                {/* ===== Graph-Modus → GraphConfigSection ===== */}
        <GraphConfigSection form={form} />

                {/* ===== Binary Storage → BinaryStorageSection ===== */}
        <BinaryStorageSection
          form={form}
          activeLibrary={activeLibrary}
          azureIngestionCustom={azureIngestionCustom}
          azureContainerWatched={azureContainerWatched}
          thumbnailStats={thumbnailStats}
          isRepairingThumbnails={isRepairingThumbnails}
          repairProgress={repairProgress}
          repairTotal={repairTotal}
          isRegeneratingThumbnails={isRegeneratingThumbnails}
          regenerateProgress={regenerateProgress}
          regenerateTotal={regenerateTotal}
          variantStats={variantStats}
          isRepairingVariants={isRepairingVariants}
          isLoadingStats={isLoadingStats}
          statsError={statsError}
          loadThumbnailStats={loadThumbnailStats}
          handleRepairThumbnails={handleRepairThumbnails}
          handleRegenerateThumbnails={handleRegenerateThumbnails}
          handleRepairVariants={handleRepairVariants}
        />

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
