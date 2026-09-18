"use client"

/**
 * @fileoverview Bericht-Schwellen der Agentensicht (Wunschliste 6, A1–A3).
 *
 * @description
 * „Der Bericht ist Zustand, Notizen und Verlaufsdateien sind Verlauf." Diese
 * vier Schwellen machen die Trennung messbar: Laenge je Rolle, Laenge des
 * Status-Abschnitts, offene Punkte mit vergangenem Datum. Jede leere Schwelle
 * schaltet ihre Regel AUS — Archiv-Konvention, kein Plattform-Wissen.
 *
 * Eigene Datei neben `agent-view-config-section.tsx` (200-Zeilen-Regel).
 */

import type { UseFormReturn } from "react-hook-form"
import {
  Card,
  CardContent,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@ks/ui'
import type { LibraryFormValues } from "./hooks/use-library-form"

type SchwellenFeld =
  | "agentViewBerichtMaxBytesAnwendung"
  | "agentViewBerichtMaxBytesPlattform"
  | "agentViewStatusMaxZeilen"
  | "agentViewUeberholtNachTagen"

interface FeldDefinition {
  name: SchwellenFeld
  label: string
  beschreibung: string
  placeholder: string
}

const FELDER: readonly FeldDefinition[] = [
  {
    name: "agentViewBerichtMaxBytesAnwendung",
    label: "Bericht-Laenge, Anwendung (Bytes)",
    beschreibung:
      "Ab wie vielen Bytes meldet der Scan „Bericht zu lang“ fuer Berichte mit rolle: anwendung (und fuer Berichte ohne Rolle)? Leer = Regel aus.",
    placeholder: "z. B. 20000",
  },
  {
    name: "agentViewBerichtMaxBytesPlattform",
    label: "Bericht-Laenge, Plattform (Bytes)",
    beschreibung:
      "Dasselbe fuer Berichte mit rolle: plattform. Ein Plattformbericht mit langer Entwicklungsgeschichte ist legitim laenger — leer = keine Grenze.",
    placeholder: "leer = keine Grenze",
  },
  {
    name: "agentViewStatusMaxZeilen",
    label: "Status-Abschnitt (Zeilen)",
    beschreibung:
      "Wie viele Zeilen darf der Abschnitt „## Status“ hoechstens haben? Gezaehlt werden nicht-leere Zeilen ausserhalb von Codebloecken. Leer = Regel aus.",
    placeholder: "z. B. 12",
  },
  {
    name: "agentViewUeberholtNachTagen",
    label: "Ueberholte Punkte (Tage)",
    beschreibung:
      "Ab wie vielen Tagen nach seinem Datum gilt ein offener Punkt unter „## Nächste Schritte“ als ueberholt? Dieselbe Regel meldet einen naechster_termin in der Vergangenheit. Leer = Regel aus.",
    placeholder: "z. B. 2",
  },
]

export function AgentViewBerichtSection({ form }: { form: UseFormReturn<LibraryFormValues> }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Agentensicht &mdash; Bericht als Zustand
        </h3>
        {FELDER.map((feld) => (
          <FormField
            key={feld.name}
            control={form.control}
            name={feld.name}
            render={({ field }) => (
              <FormItem className="rounded-lg border p-4">
                <FormLabel className="text-base">{feld.label}</FormLabel>
                <FormDescription>{feld.beschreibung}</FormDescription>
                <FormControl>
                  <Input inputMode="numeric" placeholder={feld.placeholder} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </CardContent>
    </Card>
  )
}
