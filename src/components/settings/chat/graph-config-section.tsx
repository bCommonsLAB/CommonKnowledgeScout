"use client"

/**
 * GraphConfigSection — Graph-Modus-Einstellungen der Wissensgalerie.
 *
 * Minimale Settings-Sektion für `config.chat.gallery.graph` (Zielbild §8,
 * Welle 2). Editierbar sind hier nur die häufigsten Felder: Aktivierung,
 * Default-Kantenquelle und die drei generischen Knoten-Encodings
 * (Größe/Farbe/Deckkraft = meta-Feldnamen). Komplexe Felder (`colorMap`,
 * `edgeSources`) werden via `useChatForm`-Reset durchgereicht und gehen beim
 * Speichern nicht verloren (library-config-field.mdc).
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
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useTranslation } from '@/lib/i18n/hooks'
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface GraphConfigSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

const EDGE_SOURCES = ['relations', 'sharedMeta', 'similarity'] as const

/** Settings-Komponente für den Graph-Modus. */
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

      <FormField
        control={form.control}
        name="gallery.graph.edgeSources.relations.enabled"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <FormLabel>
                {t('settings.chatForm.graphRelationsEnabled', { defaultValue: 'Beziehungen (Quelle A) berechnen' })}
              </FormLabel>
              <FormDescription>
                {t('settings.chatForm.graphRelationsEnabledDescription', {
                  defaultValue:
                    'Erlaubt das Berechnen gerichteter „unterstützt"-Kanten per LLM: Trigger pro Zeile und „für alle" im Tabellen-Kopf, sowie die Auswahl der Kantenquelle „Beziehungen" im Graph.',
                })}
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
        name="gallery.graph.defaultEdgeSource"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settings.chatForm.graphDefaultEdgeSource')}</FormLabel>
            <Select
              value={field.value || 'sharedMeta'}
              onValueChange={(value) => {
                if ((EDGE_SOURCES as readonly string[]).includes(value)) field.onChange(value)
                else console.warn('[GraphConfigSection] Ungültige Kantenquelle ignoriert:', value)
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="sharedMeta">{t('settings.chatForm.graphEdgeSourceSharedMeta')}</SelectItem>
                <SelectItem value="relations">{t('settings.chatForm.graphEdgeSourceRelations')}</SelectItem>
                <SelectItem value="similarity">{t('settings.chatForm.graphEdgeSourceSimilarity')}</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>{t('settings.chatForm.graphDefaultEdgeSourceDescription')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="gallery.graph.sizeField"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settings.chatForm.graphSizeField')}</FormLabel>
              <FormControl>
                <Input placeholder="co2_einsparung_kt" value={field.value ?? ''} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gallery.graph.colorField"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settings.chatForm.graphColorField')}</FormLabel>
              <FormControl>
                <Input placeholder="dominant_perspektive" value={field.value ?? ''} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gallery.graph.opacityField"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settings.chatForm.graphOpacityField')}</FormLabel>
              <FormControl>
                <Input placeholder="durchsetzbarkeit" value={field.value ?? ''} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('settings.chatForm.graphEncodingsHint')}</p>
    </div>
  )
}
