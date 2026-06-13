"use client"

/**
 * GalleryConfigSection — Wissensgalerie-Einstellungen.
 *
 * Enthält Card-Density, GroupBy-Feld und Facetten-Editor.
 * DetailViewType + SDG liegen seit Welle 3-IV-UX-3a in
 * content-type-section.tsx (eigener Bereich "Inhaltstyp").
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
 * Rendert Card-Density, GroupBy und Facetten-Editor.
 */
export function GalleryConfigSection({ form }: GalleryConfigSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Wissensgalerie</h3>
        <p className="text-sm text-muted-foreground">
          Wie Besucher Inhalte in der Galerie finden: Darstellung, Gruppierung
          und Filter.
        </p>
      </div>

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

      <p className="text-xs text-muted-foreground">
        Die Filter (Facetten) übernehmen Sie als Empfehlung im Archiv unter
        „Inhaltstyp“; die Feinjustierung einzelner Facetten liegt unter
        „Erweitert“.
      </p>
    </div>
  )
}
