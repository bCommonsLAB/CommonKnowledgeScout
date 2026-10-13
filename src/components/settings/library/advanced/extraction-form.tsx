"use client"

/**
 * Erweitert · Extraktion — bekannte Namen, Sprachen der Aufnahmen, Anhaenge
 * als Text. Ein Formular, drei eigene Config-Schluessel, ein Speichern-Knopf.
 * Vorher standen diese Felder unter der falschen Ueberschrift „Speicher-Abgleich"
 * in library-advanced-form.tsx (Plan Teil B, §4).
 */

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardContent,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Switch,
  Textarea,
} from '@ks/ui'
import { SprachenAuswahl } from "@/components/shared/sprachen-auswahl"
import { parseLanguagesText } from "@/lib/external-jobs/audio-languages"
import {
  extractionFormSchema,
  readExtractionForm,
  toExtractionConfig,
  type ExtractionFormValues,
} from "./extraction-form-model"
import { useLibraryConfigPatch } from "./use-library-config-patch"
import { NoLibrarySelected, SaveRow } from "./advanced-form-shell"

export function ExtractionForm() {
  const { activeLibrary, isLoading, patchConfig } = useLibraryConfigPatch()
  const form = useForm<ExtractionFormValues>({
    resolver: zodResolver(extractionFormSchema),
    defaultValues: readExtractionForm(undefined),
  })

  useEffect(() => {
    if (activeLibrary) form.reset(readExtractionForm(activeLibrary.config))
  }, [activeLibrary, form])

  const onSubmit = async (data: ExtractionFormValues) => {
    await patchConfig(toExtractionConfig(data), "Extraktion aktualisiert")
  }

  if (!activeLibrary) return <NoLibrarySelected />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <FormField
              control={form.control}
              name="extractionKnownNames"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">Bekannte Namen (Extraktion)</FormLabel>
                  <FormDescription>
                    Ein Name pro Zeile (Personen, Organisationen, Abkuerzungen).
                    Die Extraktion gleicht <code>authors</code>, <code>participants</code>{" "}
                    und <code>tags</code> gegen diese Liste ab und korrigiert
                    Hoerfehler aus Transkripten (z.&nbsp;B. &bdquo;Eichner&ldquo; &rarr;
                    Aichner). Leer = kein Abgleich.
                  </FormDescription>
                  <FormControl>
                    <Textarea rows={4} placeholder={"Peter Aichner\nThomas Egger\nPOW"} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="transcriptionLanguages"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">Sprachen der Aufnahmen (Audio-Transkription)</FormLabel>
                  <FormDescription>
                    Voreinstellung fuer den Transkriptions-Dialog, pro Datei aenderbar. Bei gemischten
                    Aufnahmen alle gesprochenen Sprachen waehlen — dann bleibt jede im Original.
                    Leer = automatisch erkennen.
                  </FormDescription>
                  <FormControl>
                    <SprachenAuswahl
                      value={parseLanguagesText(field.value).codes}
                      onChange={(codes) => field.onChange(codes.join(", "))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ingestSourceAppendix"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Anhaenge als Text in die Suche</FormLabel>
                    <FormDescription>
                      Voreinstellung fuer &bdquo;Aufbereiten &amp; Publizieren&ldquo;, pro Lauf
                      uebersteuerbar. An: die Transkripte der verbundenen Quellen (Audio,
                      Folien, Unterlagen) werden unsichtbar mit eingebettet &mdash; der Chat
                      findet Details, der Index waechst deutlich (Prueffall: 17 Chunks ohne,
                      239 mit Anhang). Aus: nur der Text der Vorlage.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <SaveRow isLoading={isLoading} isDirty={form.formState.isDirty} />
      </form>
    </Form>
  )
}
