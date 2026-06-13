"use client"

/**
 * SecretaryServiceForm — Seite "Verarbeitung" (meSpace, Welle 3-IV-UX-3a).
 *
 * Redaktionelle Transformations-Einstellungen: Template, Zielsprache
 * und Cover-Bild. Die technischen Teile (PDF-Extraktionsmethode,
 * LLM-Modell, Service-Verbindung) liegen in
 * secretary-advanced-form.tsx (Bereich "Erweitert", F8).
 *
 * Nutzt useSecretaryServiceForm: der Hook haelt ALLE Felder im
 * Form-State, Submit sendet die vollstaendige secretaryService-Config.
 */

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useSecretaryServiceForm } from "./hooks/use-secretary-service-form"
import { isBuiltinDefaultTemplateName } from "@/lib/templates/default-templates"
import {
  CORE_CONTENT_TYPES,
  SPECIAL_CONTENT_TYPES,
} from "@/components/settings/chat/content-type-section"

// Anwender-Label je Inhaltstyp (fuer die Vorlagen-Anzeige)
const TYPE_TITLES: Record<string, string> = Object.fromEntries(
  [...CORE_CONTENT_TYPES, ...SPECIAL_CONTENT_TYPES].map(o => [o.value, o.title])
)

export function SecretaryServiceForm() {
  const {
    form,
    activeLibrary,
    isLoading,
    libraryViewType,
    onSubmit,
  } = useSecretaryServiceForm()

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" autoComplete="off">
        <div className="space-y-4">
          {/* Wirksame Vorlage (F11): Die Auswahl ist Experten-Sache und liegt
              unter Erweitert — hier nur die verstaendliche Anzeige. */}
          {(() => {
            const currentTemplate = (form.watch('pdfTemplate') ?? '').trim()
            const typeTitle = TYPE_TITLES[libraryViewType] ?? libraryViewType
            const effectiveLabel =
              currentTemplate === ''
                ? `Automatisch: Standard für „${typeTitle}“`
                : isBuiltinDefaultTemplateName(currentTemplate)
                ? `Standard für „${typeTitle}“ (fest gewählt)`
                : `Experten-Vorlage: „${currentTemplate}“`
            return (
              <div className="rounded-lg border p-4 space-y-1">
                <p className="text-sm font-medium">Vorlage — Ihr Journalist</p>
                <p className="text-sm">{effectiveLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Wie ein Journalist macht die Vorlage aus dem Rohmaterial einen
                  strukturierten Beitrag — passend zum Inhaltstyp Ihrer
                  Bibliothek. Eine andere Vorlage wählen nur Experten unter{" "}
                  <Link href="/settings/advanced" className="underline">Erweitert</Link>.
                </p>
              </div>
            )
          })()}

          {/* Zielsprache */}
          <FormField
            control={form.control}
            name="targetLanguage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zielsprache</FormLabel>
                <FormControl>
                  <select
                    className="border rounded h-9 px-2 w-full"
                    value={field.value || 'de'}
                    onChange={e => field.onChange(e.target.value)}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </FormControl>
                <FormDescription>
                  Sprache, in der die transformierten Inhalte generiert werden.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cover-Bild automatisch generieren */}
          <FormField
            control={form.control}
            name="generateCoverImage"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-row items-center gap-3">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value || false}
                      onChange={field.onChange}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Cover-Bild automatisch generieren</FormLabel>
                </div>
                <FormDescription>
                  Bei Transformation automatisch ein Cover-Bild erstellen.
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Coverbild-Prompt */}
          <FormField
            control={form.control}
            name="coverImagePrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coverbild-Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="z. B. Erstelle ein Bild für: {{title}}..."
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={e => field.onChange(e.target.value)}
                    rows={3}
                    className="font-mono text-sm"
                  />
                </FormControl>
                <FormDescription>
                  Prompt-Vorlage für die Bildgenerierung. Variablen: {`{{title}}`}, {`{{summary}}`}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading || !form.formState.isDirty}
          >
            {isLoading ? "Wird gespeichert..." : "Verarbeitung speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
