"use client"

/**
 * CreateLibraryWizard — Anlege-Wizard als Dialog (Plan
 * speicher-verbindungen-und-library-anlage, C2).
 *
 * Schritte: Grundlagen → Quelle → Verarbeitung → Finden → Story → Erfassen
 * (nur Inhaltstypen mit Wizards) → Zusammenfassung. Welche Fragen es gibt,
 * wie schwer sie wiegen und was ohne Antwort gilt, steht im
 * Entscheidungskatalog (`src/lib/library-setup/`) — derselbe, gegen den die
 * Bruecke bei `bibliothek_anlegen` prueft. Pflicht-Schritte blockieren
 * „Weiter"; empfohlene lassen sich ueberspringen und stehen dann in der
 * Zusammenfassung als „offen".
 *
 * Aufgerufen von Dashboard (/start), Top-Nav, Settings-Uebersicht, dem
 * Library-Switcher und dem Library-Formular (ueber `CreateLibraryDialog`).
 */

import { useState } from "react"
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@ks/ui"
import { audioErwartet, hatErfassenWizards } from "@/lib/library-setup/inhaltstyp-merkmale"
import type { Schritt } from "@/lib/library-setup/typen"
import { SchrittErfassen, SchrittFinden, SchrittStory } from "./create-library/schritt-finden-story"
import { SchrittGrundlagen } from "./create-library/schritt-grundlagen"
import { SchrittQuelle } from "./create-library/schritt-quelle"
import { SchrittVerarbeitung } from "./create-library/schritt-verarbeitung"
import { SchrittZusammenfassung } from "./create-library/schritt-zusammenfassung"
import { useCreateLibrary } from "./create-library/use-create-library"

type WizardSchritt = Exclude<Schritt, "settings"> | "zusammenfassung"

const TITEL: Record<WizardSchritt, string> = {
  grundlagen: "Grundlagen", quelle: "Quelle", verarbeitung: "Verarbeitung", finden: "Finden",
  story: "Story", erfassen: "Erfassen", zusammenfassung: "Zusammenfassung",
}

interface CreateLibraryWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nach erfolgreicher Anlage, vor der Weiterleitung ins Archiv. */
  onCreated?: (libraryId: string) => void
}

function WizardInhalt({ onCreated, onAbbrechen }: { onCreated?: (libraryId: string) => void; onAbbrechen: () => void }) {
  const { antworten, setze, entwurf, fehler, anlegen, isSaving, libraries } = useCreateLibrary(onCreated)
  const [index, setIndex] = useState(0)

  const mitWizards = entwurf ? hatErfassenWizards(entwurf.library) : false
  const schritte: WizardSchritt[] = ["grundlagen", "quelle", "verarbeitung", "finden", "story", ...(mitWizards ? (["erfassen"] as const) : []), "zusammenfassung"]
  const aktuell = schritte[Math.min(index, schritte.length - 1)]
  const audioWirksam = entwurf ? audioErwartet(entwurf.library, entwurf.kontext) : antworten.audioErwartet === true
  const pflichtHier = entwurf?.pruefung.offen.filter((s) => s.gewicht === "pflicht" && s.schritt === aktuell) ?? []
  const letzter = aktuell === "zusammenfassung"

  return (
    <>
      <p className="text-xs text-muted-foreground">Schritt {index + 1} von {schritte.length} · {TITEL[aktuell]}</p>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {aktuell === "grundlagen" && <SchrittGrundlagen antworten={antworten} setze={setze} libraries={libraries} />}
        {aktuell === "quelle" && <SchrittQuelle antworten={antworten} setze={setze} />}
        {aktuell === "verarbeitung" && <SchrittVerarbeitung antworten={antworten} setze={setze} audioWirksam={audioWirksam} />}
        {aktuell === "finden" && <SchrittFinden antworten={antworten} setze={setze} />}
        {aktuell === "story" && <SchrittStory antworten={antworten} setze={setze} />}
        {aktuell === "erfassen" && <SchrittErfassen />}
        {aktuell === "zusammenfassung" && <SchrittZusammenfassung pruefung={entwurf?.pruefung ?? null} fehler={fehler} />}
      </div>
      {pflichtHier.length > 0 && (
        <p className="text-xs text-destructive">Noch offen: {pflichtHier.map((s) => s.titel).join(", ")}</p>
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onAbbrechen}>Abbrechen</Button>
        <Button type="button" variant="outline" disabled={index === 0 || isSaving} onClick={() => setIndex(index - 1)}>Zurück</Button>
        {letzter ? (
          <Button type="button" disabled={!entwurf || entwurf.pruefung.pflichtOffen || isSaving} onClick={() => void anlegen()}>
            {isSaving ? "Wird angelegt …" : "Bibliothek anlegen"}
          </Button>
        ) : (
          <Button type="button" disabled={pflichtHier.length > 0} onClick={() => setIndex(index + 1)}>Weiter</Button>
        )}
      </DialogFooter>
    </>
  )
}

/** Dialog-Huelle; der Inhalt wird nur bei offenem Dialog gerendert, so beginnt jede Anlage leer. */
export function CreateLibraryWizard({ open, onOpenChange, onCreated }: CreateLibraryWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Neue Bibliothek erstellen</DialogTitle>
          <DialogDescription>Pflichtangaben sind mit * markiert; Empfohlenes dürfen Sie überspringen und später nachtragen.</DialogDescription>
        </DialogHeader>
        {open && <WizardInhalt onCreated={onCreated} onAbbrechen={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
