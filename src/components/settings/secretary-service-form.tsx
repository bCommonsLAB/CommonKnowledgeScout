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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useSecretaryServiceForm } from "./hooks/use-secretary-service-form"

export function SecretaryServiceForm() {
  const {
    form,
    activeLibrary,
    isLoading,
    isLoadingTemplates,
    templateMode,
    setTemplateMode,
    mergedTemplateNames,
    hasMongoTemplates,
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
          {/* Template-Auswahl — der "Journalist" der Verarbeitung */}
          <FormField
            control={form.control}
            name="pdfTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vorlage — Ihr Journalist</FormLabel>
                <FormControl>
                  <div className="flex flex-col gap-2">
                    {templateMode === 'select' ? (
                      <select
                        className="border rounded h-9 px-2 w-full"
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(e) => {
                          const next = e.target.value
                          if (next === '__custom__') {
                            setTemplateMode('custom')
                            return
                          }
                          field.onChange(next)
                        }}
                        disabled={isLoadingTemplates && !hasMongoTemplates}
                      >
                        <option value="">{isLoadingTemplates ? 'Lade Templates…' : '(kein Default)'}</option>
                        {mergedTemplateNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="__custom__">Benutzerdefiniert…</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="z. B. pdfanalyse-commoning"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const val = (typeof field.value === 'string' ? field.value : '').trim()
                            if (val && !mergedTemplateNames.some((n) => n.toLowerCase() === val.toLowerCase())) {
                              field.onChange('')
                            }
                            setTemplateMode('select')
                          }}
                        >
                          Aus Liste
                        </Button>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Wie ein Journalist macht die Vorlage aus dem Rohmaterial einen
                  strukturierten Beitrag: Sie bestimmt, welche Abschnitte und
                  Felder dabei entstehen.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
