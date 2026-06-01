"use client"

/**
 * GalleryConfigSection — Wissensgalerie-Einstellungen.
 *
 * Extrahiert aus chat-form.tsx (Welle 3-IV-Settings-Sections-Split).
 * Enthält die Section "Wissensgalerie" mit DetailViewType, Card-Density,
 * GroupBy-Feld und Facetten-Editor.
 */

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { FacetDefsEditor } from '@/components/settings/FacetDefsEditor'
import { useTranslation } from '@/lib/i18n/hooks'
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface GalleryConfigSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

/**
 * Section-Komponente für Wissensgalerie-Einstellungen.
 * Rendert DetailViewType, Card-Density, GroupBy und Facetten-Editor.
 */
export function GalleryConfigSection({ form }: GalleryConfigSectionProps) {
  const { t } = useTranslation()

  return (
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
                  if (
                    value === 'book' ||
                    value === 'session' ||
                    value === 'climateAction' ||
                    value === 'testimonial' ||
                    value === 'blog' ||
                    value === 'divaDocument' ||
                    value === 'divaTexture' ||
                    value === 'refurbedDevice'
                  ) {
                    field.onChange(value);
                  } else {
                    console.warn('[GalleryConfigSection] Ungültiger detailViewType ignoriert:', value);
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
        name="gallery.showSdgProfile"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel>{t('settings.chatForm.galleryShowSdgProfile')}</FormLabel>
              <FormDescription>
                {t('settings.chatForm.galleryShowSdgProfileDescription')}
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value === true} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
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
                  console.warn('[GalleryConfigSection] Ungültige galleryCardDensity ignoriert:', value)
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
  )
}
