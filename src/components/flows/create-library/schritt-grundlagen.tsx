"use client"

/** Wizard-Schritt Grundlagen: Name, Inhaltstyp, Vorlage-Library (C2). */

import { Card, CardContent, Checkbox, Input, Label } from "@ks/ui"
import { CORE_CONTENT_TYPES, SPECIAL_CONTENT_TYPES } from "@/components/settings/chat/content-type-section"
import type { VorhandeneLibrary } from "@/lib/library-setup/wizard-antworten"
import type { SchrittProps } from "./schritt-props"

interface Props extends SchrittProps {
  libraries: readonly VorhandeneLibrary[]
}

export function SchrittGrundlagen({ antworten, setze, libraries }: Props) {
  const gleicherTyp = libraries.filter((l) => antworten.inhaltstyp !== "" && l.config?.chat?.gallery?.detailViewType === antworten.inhaltstyp)
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="wizard-name">Name *</Label>
        <Input id="wizard-name" autoFocus placeholder="z. B. Mein Archiv" value={antworten.name} onChange={(e) => setze({ name: e.target.value })} />
      </div>

      <div className="grid gap-2">
        <Label>Was wird die Bibliothek enthalten? *</Label>
        <div className="grid gap-2 md:grid-cols-3">
          {[...CORE_CONTENT_TYPES, ...SPECIAL_CONTENT_TYPES].map((option) => (
            <Card
              key={option.value}
              role="button"
              onClick={() => setze({ inhaltstyp: option.value, vorlageVon: "" })}
              className={`cursor-pointer transition-colors ${antworten.inhaltstyp === option.value ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40"}`}
            >
              <CardContent className="p-3">
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {gleicherTyp.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="wizard-vorlage">Konfiguration einer bestehenden Bibliothek übernehmen (empfohlen)</Label>
          <select
            id="wizard-vorlage"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={antworten.vorlageVon}
            onChange={(e) => setze({ vorlageVon: e.target.value })}
          >
            <option value="">— keine —</option>
            {gleicherTyp.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Übernommen werden Facetten, Antwortregeln, Galerie, Sprache, Verarbeitung — keine Zugangsdaten, keine Veröffentlichung.
          </p>
          {antworten.vorlageVon && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={antworten.vorlagenKopieren} onCheckedChange={(c) => setze({ vorlagenKopieren: c === true })} />
              auch die Vorlagen (Templates) kopieren
            </label>
          )}
        </div>
      )}
    </div>
  )
}
