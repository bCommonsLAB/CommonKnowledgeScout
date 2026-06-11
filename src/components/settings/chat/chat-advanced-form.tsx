"use client"

/**
 * ChatAdvancedForm — Experten-Teil der Chat-/Galerie-Konfiguration
 * (Bereich "Erweitert", Welle 3-IV-UX-3a, F7/F8).
 *
 * RAG-Parameter, LLM-Modell, Such-Index-Verwaltung und Binary Storage.
 * Nutzt den vollen useChatForm-Hook (siehe Hinweis in
 * content-type-form.tsx — Submit sendet die vollstaendige Config).
 */

import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { IndexDefinitionDialog } from '@/components/settings/index-definition-dialog'
import { SearchIndexDialog } from '@/components/settings/search-index-dialog'
import { toast } from "@/components/ui/use-toast"
import { useTranslation } from '@/lib/i18n/hooks'
import { useChatForm } from './hooks/use-chat-form'
import { RetrievalConfigSection } from './retrieval-config-section'
import { LlmModelSection } from './llm-model-section'
import { BinaryStorageSection } from './binary-storage-section'
import { GraphAdvancedSection } from './graph-advanced-section'
import { FacetDefsEditor } from '@/components/settings/FacetDefsEditor'

export function ChatAdvancedForm() {
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
        <RetrievalConfigSection form={form} defaultEmbeddings={defaultEmbeddings} />

        <LlmModelSection form={form} />

        {/* Facetten im Detail (Petra-Review Punkt 3: aus Explore hierher) */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">Galerie-Filter (Facetten)</h3>
            <p className="text-sm text-muted-foreground">
              Feinjustierung der Explore-Filter. Empfehlungen je Inhaltstyp
              übernehmen Sie bequemer im Archiv unter „Inhaltstyp“.
            </p>
          </div>
          <FacetDefsEditor
            value={form.watch("gallery.facets") || []}
            onChange={(v) => form.setValue("gallery.facets", v, { shouldDirty: true })}
            detailViewType={form.watch("gallery.detailViewType")}
          />
        </div>

        <GraphAdvancedSection form={form} />

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
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('settings.chatForm.saving') : t('settings.chatForm.save')}
          </Button>
        </div>
      </form>

      <IndexDefinitionDialog
        open={showIndexDialog}
        onOpenChange={setShowIndexDialog}
        collectionName={collectionName}
        indexDefinition={indexDefinition}
      />

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
