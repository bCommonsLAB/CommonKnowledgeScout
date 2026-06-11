"use client"

/**
 * ContentTypeSection — Inhaltstyp & Detailansicht.
 *
 * Extrahiert aus gallery-config-section.tsx (Welle 3-IV-UX-3a):
 * Der Inhaltstyp bestimmt das Layout der Detailansicht und ist die
 * Grundlage fuer typabhaengige Optionen (z.B. SDG-Profil).
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
import { useTranslation } from '@/lib/i18n/hooks'
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface ContentTypeSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

/**
 * Section-Komponente für Inhaltstyp und typabhängige Detail-Optionen.
 */
export function ContentTypeSection({ form }: ContentTypeSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Inhaltstyp & Detailansicht</h3>
        <p className="text-sm text-muted-foreground">
          Was enthält Ihre Bibliothek? Der Inhaltstyp bestimmt, mit welchem
          Layout Ihre Dokumente angezeigt werden.
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
                    console.warn('[ContentTypeSection] Ungültiger detailViewType ignoriert:', value);
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
    </div>
  )
}
