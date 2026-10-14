"use client"

/**
 * Wizard-Schritt Verarbeitung (C2): Aufnahmen erwartet? Sprachen der
 * Aufnahmen, bekannte Namen. Owner-Entscheid E6: die beiden Fragen gelten nur,
 * wenn Audio erwartet wird.
 */

import { Button, Input, Label, Textarea } from "@ks/ui"
import type { SchrittProps } from "./schritt-props"

interface Props extends SchrittProps {
  /** Aus Inhaltstyp und Antwort abgeleitet (`audioErwartet` des Katalogs). */
  audioWirksam: boolean
}

export function SchrittVerarbeitung({ antworten, setze, audioWirksam }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label>Kommen Aufnahmen (Audio/Video), die transkribiert werden?</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={audioWirksam ? "default" : "outline"} onClick={() => setze({ audioErwartet: true })}>Ja</Button>
          <Button type="button" size="sm" variant={!audioWirksam ? "default" : "outline"} onClick={() => setze({ audioErwartet: false })}>Nein</Button>
        </div>
        {antworten.audioErwartet === null && <p className="text-xs text-muted-foreground">Vorschlag aus dem Inhaltstyp.</p>}
      </div>

      {audioWirksam ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="wizard-sprachen">Sprachen der Aufnahmen (empfohlen)</Label>
            <Input id="wizard-sprachen" placeholder="de, it" value={antworten.aufnahmeSprachen} onChange={(e) => setze({ aufnahmeSprachen: e.target.value })} />
            <p className="text-xs text-muted-foreground">ISO-Codes, durch Komma getrennt. Leer: das Modell entscheidet je Stück.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wizard-namen">Bekannte Namen und Organisationen (empfohlen)</Label>
            <Textarea id="wizard-namen" rows={4} placeholder={"Ein Name je Zeile"} value={antworten.bekannteNamen} onChange={(e) => setze({ bekannteNamen: e.target.value })} />
            <p className="text-xs text-muted-foreground">Hilft der Transkription bei der Schreibweise. Leer: keine.</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Ohne Aufnahmen gibt es hier nichts zu entscheiden.</p>
      )}
    </div>
  )
}
