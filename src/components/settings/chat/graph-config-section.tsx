"use client"

/**
 * GraphConfigSection — Graph-Modus auf der Explore-Seite.
 *
 * Seit dem Petra-Review (Welle 3-IV-UX) bleibt hier nur der einfache
 * An/Aus-Schalter. Kantenquellen und Knoten-Encodings sind Experten-
 * Territorium und liegen in graph-advanced-section.tsx (Erweitert).
 * Komplexe Felder (`colorMap`, `edgeSources`) werden via useChatForm-
 * Reset durchgereicht und gehen beim Speichern nicht verloren.
 */

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { useTranslation } from '@/lib/i18n/hooks'
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface GraphConfigSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

/** Settings-Komponente für den Graph-Modus (Einsteiger-Teil). */
export function GraphConfigSection({ form }: GraphConfigSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">{t('settings.chatForm.graphTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.chatForm.graphDescription')}</p>
      </div>

      <FormField
        control={form.control}
        name="gallery.graph.enabled"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <FormLabel>{t('settings.chatForm.graphEnabled')}</FormLabel>
              <FormDescription>{t('settings.chatForm.graphEnabledDescription')}</FormDescription>
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
