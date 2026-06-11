"use client"

/**
 * ContentTypeForm — Seite "Inhaltstyp" (meSpace, Welle 3-IV-UX-3a).
 *
 * Nutzt den vollen useChatForm-Hook: react-hook-form haelt ALLE
 * chat-Config-Werte im State (per reset geladen), gerendert wird nur
 * die Inhaltstyp-Section. Submit sendet damit dieselbe vollstaendige
 * Config wie das fruehere Gesamtformular — kein Merge-Risiko.
 */

import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { useTranslation } from '@/lib/i18n/hooks'
import { useChatForm } from './hooks/use-chat-form'
import { ContentTypeSection } from './content-type-section'

export function ContentTypeForm() {
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
        <ContentTypeSection form={form} />
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('settings.chatForm.saving') : t('settings.chatForm.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
