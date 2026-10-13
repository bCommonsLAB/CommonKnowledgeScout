"use client"

/**
 * Erweitert · DIVA — Liefersystem-Daten auswerten, Konfidenz-Schwelle der
 * Auto-Klassifikation, Dateilisten-Vorgaben. Ein Formular, drei eigene
 * Config-Schluessel, ein Speichern-Knopf. Immer sichtbar (Owner-Entscheid E3).
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
  Input,
  Switch,
} from '@ks/ui'
import { divaFormSchema, readDivaForm, toDivaConfig, type DivaFormValues } from "./diva-form-model"
import { DivaArchiveDefaultsSection } from "./diva-archive-defaults-section"
import { useLibraryConfigPatch } from "./use-library-config-patch"
import { NoLibrarySelected, SaveRow } from "./advanced-form-shell"

export function DivaForm() {
  const { activeLibrary, isLoading, patchConfig } = useLibraryConfigPatch()
  const form = useForm<DivaFormValues>({
    resolver: zodResolver(divaFormSchema),
    defaultValues: readDivaForm(undefined),
  })

  useEffect(() => {
    if (activeLibrary) form.reset(readDivaForm(activeLibrary.config))
  }, [activeLibrary, form])

  const onSubmit = async (data: DivaFormValues) => {
    await patchConfig(toDivaConfig(data), "DIVA-Einstellungen aktualisiert")
  }

  if (!activeLibrary) return <NoLibrarySelected />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <FormField
              control={form.control}
              name="analyzeDivaTextureInfo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">DIVA-Liefersystem-Daten auswerten</FormLabel>
                    <FormDescription>
                      Zeigt im Archiv-Detail einen Tab &quot;DIVA-Info&quot;, sobald eine
                      Sidecar-Datei (optionvalues.json) im Grosseltern-Ordner des
                      Texturverzeichnisses liegt und ein Treffer fuer die Textur existiert.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoApplyConfidenceThreshold"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">Auto-Uebernahme ab Konfidenz (Stoffgruppe)</FormLabel>
                  <FormDescription>
                    Schwellwert fuer die Auto-Uebernahme der Stoffgruppen-Klassifikation
                    (Stufe 4). Wenn der vom LLM bestimmte Wert{" "}
                    <code>confidence_class</code> diesen Schwellwert erreicht, kann die
                    Klassifikation ohne weitere Bestaetigung auf alle Mitglieder der Gruppe
                    uebernommen werden. Bereich [0, 1].
                  </FormDescription>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={field.value}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) field.onChange(Math.min(1, Math.max(0, v)))
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DivaArchiveDefaultsSection form={form} />
          </CardContent>
        </Card>
        <SaveRow isLoading={isLoading} isDirty={form.formState.isDirty} />
      </form>
    </Form>
  )
}
