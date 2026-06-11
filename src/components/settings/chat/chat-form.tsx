"use client"

/**
 * ChatForm — Seite "Chat" (meSpace, Welle 3-IV-UX-3a).
 *
 * Enthaelt nur noch die Einsteiger-Einstellungen: Chat-UI-Texte und
 * Perspektive (Sprache/Tonfall). Inhaltstyp, Galerie und die
 * Experten-Teile (RAG, LLM, Index, Binary Storage) liegen in eigenen
 * Bereichen: content-type-form, gallery-form, chat-advanced-form.
 *
 * Nutzt den vollen useChatForm-Hook (siehe Hinweis in
 * content-type-form.tsx — Submit sendet die vollstaendige Config).
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
import { useTranslation } from '@/lib/i18n/hooks'
import { useChatForm } from './hooks/use-chat-form'
import { ModelConfigSection } from './model-config-section'

export function ChatForm() {
  const { t } = useTranslation()
  const { form, activeLibrary, isLoading, onSubmit } = useChatForm()

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

        {/* ===== Eigene Perspektive ===== */}
        <ModelConfigSection form={form} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('settings.chatForm.saving') : t('settings.chatForm.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
