"use client"

/**
 * Archive · 4 Erfassen — welche „Inhalte erfassen"-Wizards die Bibliothek
 * anbietet (Plan 2 · W-C). Ein Formular, ein Config-Schluessel
 * (`captureWizards`), ein Speichern-Knopf. Vorher unter „Erweitert"
 * (Owner-Entscheid E5: gehoert als Schritt 4 auf die Archive-Seite).
 */

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@ks/ui'
import { CaptureWizardsEditor } from "./capture-wizards-editor"
import { useLibraryConfigPatch } from "./advanced/use-library-config-patch"
import { NoLibrarySelected, SaveRow } from "./advanced/advanced-form-shell"

export const captureWizardsFormSchema = z.object({
  captureWizards: z
    .object({
      wizards: z.array(
        z.object({
          flowId: z.string(),
          schemaRef: z.string().optional(),
          label: z.string().optional(),
          icon: z.string().optional(),
          enabled: z.boolean(),
        }),
      ),
      defaultFlowId: z.string().optional(),
    })
    .optional(),
})

type CaptureWizardsFormValues = z.infer<typeof captureWizardsFormSchema>

export function CaptureWizardsForm() {
  const { activeLibrary, activeLibraryId, isLoading, patchConfig } = useLibraryConfigPatch()
  const form = useForm<CaptureWizardsFormValues>({
    resolver: zodResolver(captureWizardsFormSchema),
    defaultValues: { captureWizards: undefined },
  })

  useEffect(() => {
    if (activeLibrary) form.reset({ captureWizards: activeLibrary.config?.captureWizards })
  }, [activeLibrary, form])

  const onSubmit = async (data: CaptureWizardsFormValues) => {
    // Wie bisher: ohne Auswahl (undefined) wird der Schluessel nicht gesendet,
    // der gespeicherte Stand bleibt (Bestandsverhalten der Gesamt-Form).
    await patchConfig({ captureWizards: data.captureWizards }, "Inhalte erfassen aktualisiert")
  }

  if (!activeLibrary) return <NoLibrarySelected />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="captureWizards"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">Welche Wizards anbieten</FormLabel>
                  <FormDescription>
                    Waehle, welche Erfassungs-Wizards unter &quot;Inhalte erfassen&quot; erscheinen,
                    in welcher Reihenfolge und welcher der Default ist. Ohne Auswahl gilt das
                    Bestandsverhalten.
                  </FormDescription>
                  <FormControl>
                    <CaptureWizardsEditor
                      libraryId={activeLibraryId ?? undefined}
                      value={field.value}
                      onChange={field.onChange}
                    />
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
