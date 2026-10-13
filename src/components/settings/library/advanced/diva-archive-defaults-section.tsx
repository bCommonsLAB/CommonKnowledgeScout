"use client"

/**
 * DIVA-Archive-Defaults: Toolbar-Voreinstellungen fuer die Archiv-Dateiliste
 * (Filter, Gruppierung, Zusatzspalten). Section des DIVA-Formulars.
 */

import type { UseFormReturn } from "react-hook-form"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ks/ui'
import type { DivaFormValues } from "./diva-form-model"

export function DivaArchiveDefaultsSection({ form }: { form: UseFormReturn<DivaFormValues> }) {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h4 className="text-base font-medium">DIVA-Einstellungen (Archiv-Dateiliste)</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Default-Werte fuer das DIVA-Toolbar-Popover: Filter,
          Gruppierung, Zusatzspalten. Diese werden beim Oeffnen der
          Bibliothek in die Toolbar uebernommen.
        </p>
      </div>

      <FormField
        control={form.control}
        name="divaArchiveFilterMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Filter-Default</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="all">Alle *_basecolor</SelectItem>
                <SelectItem value="with">Nur *_basecolor mit DIVA-Info</SelectItem>
                <SelectItem value="without">Nur *_basecolor ohne DIVA-Info</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="divaArchiveGroupByAttribute"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Gruppieren nach (Default)</FormLabel>
            <FormDescription>
              Annotations-Attribut, z.B. <code>stoffgruppe</code>,{" "}
              <code>material</code>, <code>textur_name</code>, <code>farbe_hex</code>.
              Leer = keine Gruppierung.
            </FormDescription>
            <FormControl>
              <Input {...field} placeholder="z.B. stoffgruppe" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="divaArchiveExtraColumns"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Zusatzspalten (Default)</FormLabel>
            <FormDescription>
              Komma-separierte Liste von Sidecar-Feldern, die in der
              Dateiliste angezeigt werden. <code>_thumbnail</code>
              {" "}rendert das Preview-Bitmap. Beispiel:{" "}
              <code>_thumbnail, Material, TextureName, RGB</code>.
            </FormDescription>
            <FormControl>
              <Input
                value={field.value.join(", ")}
                placeholder="_thumbnail, Material, TextureName"
                onChange={(e) => {
                  const parts = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                  field.onChange(parts)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
