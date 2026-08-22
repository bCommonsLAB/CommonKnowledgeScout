"use client"

/**
 * @fileoverview Agentensicht-Konventionen in den Library-Einstellungen.
 *
 * @description
 * Die Ordner-Konventionen der Agentensicht sind ARCHIV-Wissen, nicht
 * Plattform-Wissen (Projektauftrag F2) — deshalb pro Library konfigurierbar.
 * Ohne Konfiguration gelten die dokumentierten Defaults: Vorhaben nur per
 * Selbstdeklaration (`bearbeitungsstand` im `_INDEX.md`), `_INDEX.md`-Pflicht
 * inaktiv, Bericht-Frische aktiv.
 *
 * Eigene Datei statt weiterem Wachstum der library-advanced-form (200-Zeilen-Regel).
 */

import type { UseFormReturn } from "react-hook-form"
import { Card, CardContent } from "@/components/ui/card"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { LibraryFormValues } from "./hooks/use-library-form"

export function AgentViewConfigSection({ form }: { form: UseFormReturn<LibraryFormValues> }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Agentensicht
        </h3>

        <FormField
          control={form.control}
          name="agentViewEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Agentensicht aktivieren</FormLabel>
                <FormDescription>
                  Zeigt den Menuepunkt &bdquo;Agentensicht&ldquo; und die
                  Coverage-Seite fuer diese Bibliothek. Standard: aus &mdash;
                  die Sicht ist ein Opt-in pro Bibliothek.
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
          name="agentViewVorhabenPattern"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <FormLabel className="text-base">Vorhaben-Muster (Regex)</FormLabel>
              <FormDescription>
                Ordnernamen, die auf dieses Muster passen, gelten als Vorhaben
                (z.&nbsp;B. <code>^\d{'{2}'}\.\d{'{2}'} </code> fuer{" "}
                <code>25.01 …</code>). Leer = Vorhaben nur ueber{" "}
                <code>bearbeitungsstand</code> im <code>_INDEX.md</code>.
              </FormDescription>
              <FormControl>
                <Input placeholder={"^\\d{2}\\.\\d{2} "} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agentViewIndexDepth"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <FormLabel className="text-base">_INDEX.md-Pflicht bis Tiefe</FormLabel>
              <FormDescription>
                Bis zu dieser Ordnertiefe meldet die Sicht fehlende{" "}
                <code>_INDEX.md</code> (0 = nur Wurzel, 1 = eine Ebene darunter, …).
                Leer = Regel inaktiv.
              </FormDescription>
              <FormControl>
                <Input inputMode="numeric" placeholder="leer = inaktiv" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agentViewBerichtFreshness"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Bericht-Frische pruefen</FormLabel>
                <FormDescription>
                  Meldet <code>BERICHT.md</code>, die aelter als die juengste
                  Aenderung ihres Vorhabens sind (<code>bericht_veraltet</code>).
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
          name="agentViewLocalRootPath"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <FormLabel className="text-base">Lokaler Wurzelpfad (Auftraege)</FormLabel>
              <FormDescription>
                Optional: der Pfad, unter dem das Archiv lokal gemountet ist
                (z.&nbsp;B. <code>C:\Users\peter\OneDrive\Archiv</code>). Der
                Auftrags-Generator rendert damit absolute Pfade; leer =
                archiv-relative Pfade.
              </FormDescription>
              <FormControl>
                <Input placeholder="leer = relative Pfade" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}
