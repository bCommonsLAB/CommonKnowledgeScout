"use client"

/**
 * ModelConfigSection — Perspektive der Chat-Antworten.
 *
 * Enthält Zielsprache, Charakter und Sozialkontext. Die LLM-Modell-
 * Auswahl liegt seit Welle 3-IV-UX-3a in llm-model-section.tsx
 * (Bereich "Erweitert", F8).
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
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface ModelConfigSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

/**
 * Section-Komponente für Perspektiv-Einstellungen.
 * Rendert Zielsprache, Charakter und Sozialkontext.
 */
export function ModelConfigSection({ form }: ModelConfigSectionProps) {
  const { t } = useTranslation()
  const { targetLanguageLabels, characterLabels, socialContextLabels } = useStoryContext()
  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Eigene Perspektive</h3>
        <p className="text-sm text-muted-foreground">
          Sprache und Tonfall der Chat-Antworten.
        </p>
      </div>

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
  )
}
