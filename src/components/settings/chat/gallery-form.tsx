"use client"

/**
 * GalleryForm — Seite "Galerie" (meSpace, Welle 3-IV-UX-3a).
 *
 * Wie Besucher Inhalte finden: Darstellung, Gruppierung, Facetten und
 * Graph-Modus. Nutzt den vollen useChatForm-Hook (siehe Hinweis in
 * content-type-form.tsx — Submit sendet die vollstaendige Config).
 * Der IndexDefinitionDialog ist hier gemountet, weil Facetten-
 * Aenderungen eine neue Atlas-Index-Definition ausloesen koennen.
 */

import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { useTranslation } from '@/lib/i18n/hooks'
import { useChatForm } from './hooks/use-chat-form'
import { GalleryConfigSection } from './gallery-config-section'
import { GraphConfigSection } from './graph-config-section'

export function GalleryForm() {
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
        <GalleryConfigSection form={form} />
        <GraphConfigSection form={form} />
        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
            {isLoading ? t('settings.chatForm.saving') : 'Explore-Einstellungen speichern'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
