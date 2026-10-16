"use client"

/** Wizard-Schritte Finden, Story und Erfassen (C2) — alle empfohlen, ueberspringbar. */

import { Button, Checkbox, Label, Textarea } from "@ks/ui"
import { TARGET_LANGUAGE_VALUES } from "@ks/contracts"
import { standardFacettenFuer } from "@/lib/library-setup/standard-facetten"
import type { SchrittProps } from "./schritt-props"

export function SchrittFinden({ antworten, setze }: SchrittProps) {
  const vorschlag = antworten.inhaltstyp ? standardFacettenFuer(antworten.inhaltstyp) : []
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={antworten.facettenStandard} onCheckedChange={(c) => setze({ facettenStandard: c === true })} />
          Standard-Facetten des Inhaltstyps als Filter übernehmen (empfohlen)
        </label>
        <p className="text-xs text-muted-foreground">
          {vorschlag.length > 0 ? `Vorschlag: ${vorschlag.map((f) => f.label).join(", ")}.` : "Erst den Inhaltstyp wählen."}
          {" "}Ohne Haken bleiben die Facetten offen; anpassen jederzeit unter Settings → Galerie.
        </p>
      </div>
      <div className="grid gap-2">
        <Label>Graph-Ansicht in der Galerie anbieten? (empfohlen)</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={antworten.graph === true ? "default" : "outline"} onClick={() => setze({ graph: true })}>Ja</Button>
          <Button type="button" size="sm" variant={antworten.graph === false ? "default" : "outline"} onClick={() => setze({ graph: false })}>Nein</Button>
        </div>
      </div>
    </div>
  )
}

export function SchrittStory({ antworten, setze }: SchrittProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="wizard-antwortsprache">Antwortsprache des Story-Modus (empfohlen)</Label>
        <select
          id="wizard-antwortsprache"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={antworten.antwortsprache}
          onChange={(e) => setze({ antwortsprache: e.target.value })}
        >
          <option value="">— offen lassen —</option>
          {TARGET_LANGUAGE_VALUES.map((s) => (
            <option key={s} value={s}>{s === "global" ? "global (Sprache der Oberfläche)" : s}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="wizard-antwortregeln">Antwortregeln (empfohlen)</Label>
        <Textarea
          id="wizard-antwortregeln"
          rows={5}
          placeholder="z. B. Antworte knapp und nenne die Veranstaltung ({{facette:event}})."
          value={antworten.antwortregeln}
          onChange={(e) => setze({ antwortregeln: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Platzhalter {"{{facette:<metaKey>}}"} beziehen sich auf die Facetten aus „Finden“.</p>
      </div>
    </div>
  )
}

export function SchrittErfassen() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        Dieser Inhaltstyp bietet „Inhalte erfassen“-Wizards an. Welche davon die Bibliothek zeigt, wählen Sie nach dem
        Anlegen unter <strong>Settings → Archive · 4 Erfassen</strong>.
      </p>
      <p className="text-muted-foreground">Bis dahin gilt nur der Standard-Wizard; die Entscheidung bleibt als „offen“ sichtbar.</p>
    </div>
  )
}
