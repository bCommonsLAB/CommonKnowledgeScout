"use client"

/**
 * Formularfeld fuer das Design-Profil der Website (Welle S2).
 *
 * Das Profil ist ein kleines JSON-Objekt (`SiteTheme` in `@ks/contracts`);
 * das Formular zeigt es als Text, weil der Hauptweg die Bruecke ist
 * (`veroeffentlichung_setzen`, Skill `website-publishing`). Geprueft wird es
 * im Zod-Schema des Formulars mit denselben Regeln wie in der Bruecke
 * (`validiereSiteTheme`). Leer = Vorlage „Oldies for Future".
 */

import * as React from "react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Textarea } from "@ks/ui"
import { SITE_FONT_NAMES, SITE_SURFACES } from "@ks/contracts"

const BEISPIEL = `{
  "fontHeading": "newsreader",
  "fontBody": "plus-jakarta",
  "accent": "#c85a32",
  "buttonShape": "rounded",
  "surfaces": {
    "default": { "bg": "#faf8f5", "text": "#1c3829" },
    "dark-green": { "bg": "#1c3829", "text": "#f4f6f4" }
  }
}`

export function SiteThemeField<T extends FieldValues & { siteThemeJson?: string }>({ control }: { control: Control<T> }): React.ReactElement {
  return (
    <FormField
      control={control}
      name={"siteThemeJson" as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Design-Profil (JSON)</FormLabel>
          <FormControl>
            <Textarea rows={8} placeholder={BEISPIEL} className="font-mono text-xs" {...field} value={typeof field.value === "string" ? field.value : ""} />
          </FormControl>
          <FormDescription>
            Leer = Gestaltung der Vorlage. Schriften: {SITE_FONT_NAMES.join(", ")}. Flächen: {SITE_SURFACES.join(", ")} mit
            {" "}<code className="text-xs">bg</code>, <code className="text-xs">text</code>, optional <code className="text-xs">heading</code>,{" "}
            <code className="text-xs">paragraph</code>, <code className="text-xs">kicker</code> als <code className="text-xs">#rrggbb</code>.
            Nur genannte Flächen weichen von der Vorlage ab. Dasselbe setzt die Brücke mit <code className="text-xs">veroeffentlichung_setzen</code>.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
