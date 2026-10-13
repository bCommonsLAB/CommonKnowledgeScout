"use client"

/**
 * Erweitert · Speicher & Twins — Shadow-Twin-Schalter, Medien-Speicher-
 * Strategie (Vorschau) und Scan-Ausschluss. Ein Formular, zwei eigene
 * Config-Schluessel (`shadowTwin`, `scanExcludeGlobs`), ein Speichern-Knopf.
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
  Textarea,
} from '@ks/ui'
import { ShadowTwinConfigSection } from "../shadow-twin-config-section"
import {
  readStorageTwinsForm,
  storageTwinsFormSchema,
  toStorageTwinsConfig,
  type StorageTwinsFormValues,
} from "./storage-twins-form-model"
import { useShadowTwinFlags } from "./use-shadow-twin-flags"
import { useLibraryConfigPatch } from "./use-library-config-patch"
import { NoLibrarySelected, SaveRow } from "./advanced-form-shell"

export function StorageTwinsForm() {
  const { activeLibrary, activeLibraryId, isLoading, patchConfig } = useLibraryConfigPatch()
  const twin = useShadowTwinFlags(activeLibrary)
  const form = useForm<StorageTwinsFormValues>({
    resolver: zodResolver(storageTwinsFormSchema),
    defaultValues: readStorageTwinsForm(undefined),
  })

  useEffect(() => {
    if (activeLibrary) form.reset(readStorageTwinsForm(activeLibrary.config))
  }, [activeLibrary, form])

  const onSubmit = async (data: StorageTwinsFormValues) => {
    await patchConfig(toStorageTwinsConfig(data, twin.flags), "Speicher & Twins aktualisiert")
  }

  if (!activeLibrary) return <NoLibrarySelected />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Cache & Speicherstrategie */}
        <Card>
          <CardContent className="space-y-6 pt-6">
            <ShadowTwinConfigSection
              activeLibraryId={activeLibraryId}
              activeLibrary={activeLibrary}
              shadowTwinPersistToFilesystem={twin.flags.persistToFilesystem}
              setShadowTwinPersistToFilesystem={twin.setPersistToFilesystem}
              shadowTwinAllowFilesystemFallback={twin.flags.allowFilesystemFallback}
              setShadowTwinAllowFilesystemFallback={twin.setAllowFilesystemFallback}
              azureConfigured={twin.azureConfigured}
            />
          </CardContent>
        </Card>

        {/* Scan-Ausschluss (Welle 0b) */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Scan-Ausschluss
            </h3>
            <FormField
              control={form.control}
              name="scanExcludeGlobs"
              render={({ field }) => (
                <FormItem className="rounded-lg border p-4">
                  <FormLabel className="text-base">Ausschluss-Muster fuer Scans</FormLabel>
                  <FormDescription>
                    Ein Muster pro Zeile. Ohne Schraegstrich wirkt es auf jeden
                    Ordner-/Dateinamen (z.&nbsp;B. <code>temp</code>, <code>*.tmp</code>),
                    mit Schraegstrich auf den Pfad ab Bibliothekswurzel
                    (z.&nbsp;B. <code>alt/archiv/**</code>). Uebersprungenes wird im
                    Abgleich-Bericht gezaehlt, nie still ausgelassen. Leer =
                    Standard-Ausschluesse (<code>.obsidian</code>, <code>.trash</code>,{" "}
                    <code>.ck-meta</code>, <code>.wizard-sources</code>, <code>temp</code>);
                    eigene Muster ersetzen die Standardliste komplett.
                  </FormDescription>
                  <FormControl>
                    <Textarea rows={3} placeholder={"temp\n*.tmp"} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <SaveRow isLoading={isLoading} isDirty={form.formState.isDirty || twin.isDirty} />
      </form>
    </Form>
  )
}
