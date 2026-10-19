/**
 * @fileoverview Felder des Mitreden-Bands (Plan galerie-buergeransicht, G5).
 *
 * @description
 * Vier Textfelder im Formular Veröffentlichung: Überschrift, Zeile, Knopftext,
 * Ziel. Das Band erscheint im geführten Galerie-Profil unter der Liste; ohne
 * Überschrift oder Ziel gibt es kein Band. Dieselbe Text-Gruppe setzt die
 * Brücke über `veroeffentlichung_setzen` (`mitreden`).
 */

"use client"

import * as React from "react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input } from "@ks/ui"

interface MitredenWerte extends FieldValues {
  mitredenHeadline?: string
  mitredenText?: string
  mitredenButtonLabel?: string
  mitredenHref?: string
}

const FELDER: ReadonlyArray<{ name: keyof MitredenWerte & string; label: string; platzhalter: string; hinweis?: string }> = [
  { name: "mitredenHeadline", label: "Mitreden-Band: Überschrift", platzhalter: "z. B. Wer kommentiert, ist Expertin", hinweis: "Leer = kein Band." },
  { name: "mitredenText", label: "Mitreden-Band: Zeile", platzhalter: "z. B. Deine Erfahrung zu einer Maßnahme hilft allen weiter." },
  { name: "mitredenButtonLabel", label: "Mitreden-Band: Knopf", platzhalter: "Mitreden", hinweis: "Leer = „Mitreden“." },
  { name: "mitredenHref", label: "Mitreden-Band: Ziel", platzhalter: "/explore/<slug>?site=mitreden oder https://…", hinweis: "Pfad mit „/“ oder Adresse mit „https://“. Leer = kein Band." },
]

export function MitredenFields<T extends MitredenWerte>({ control }: { control: Control<T> }): React.ReactElement {
  return (
    <div className="space-y-4" data-mitreden-felder>
      {FELDER.map((feld) => (
        <FormField
          key={feld.name}
          control={control}
          name={feld.name as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{feld.label}</FormLabel>
              <FormControl>
                <Input placeholder={feld.platzhalter} {...field} value={typeof field.value === "string" ? field.value : ""} />
              </FormControl>
              {feld.hinweis && <FormDescription>{feld.hinweis}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  )
}
