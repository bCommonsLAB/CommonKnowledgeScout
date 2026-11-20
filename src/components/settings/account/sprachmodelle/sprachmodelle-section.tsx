"use client"

/**
 * Konto-Seite „Sprachmodelle": die globale Modell-Liste, aus der alle
 * Auswahlfelder schöpfen (Story-Modus, Library-Einstellungen Chat und
 * Transformation, Pipeline). Pflegen darf sie nur der Admin der Plattform
 * (`KS_ADMIN_EMAIL`); die Routen prüfen das selbst.
 */

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button, Table, TableBody, TableHead, TableHeader, TableRow, TooltipProvider } from "@ks/ui"
import type { SprachmodellZeile } from "@/types/sprachmodell"
import { ModellBearbeitenDialog } from "./modell-bearbeiten-dialog"
import { ModellHinzufuegenDialog } from "./modell-hinzufuegen-dialog"
import { ModellZeile } from "./modell-zeile"
import { useSprachmodelle } from "./use-sprachmodelle"

function verschoben(modelle: SprachmodellZeile[], von: number, nach: number): string[] {
  const ids = modelle.map((m) => m.modelId)
  const [eintrag] = ids.splice(von, 1)
  ids.splice(nach, 0, eintrag)
  return ids
}

export function SprachmodelleSection() {
  const { daten, ladeFehler, beschaeftigt, hinzufuegen, aendern, ordnen, probe } = useSprachmodelle()
  const [hinzufuegenOffen, setHinzufuegenOffen] = useState(false)
  const [bearbeiten, setBearbeiten] = useState<SprachmodellZeile | null>(null)
  const modelle = daten?.modelle ?? []

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Gilt für alle Bibliotheken. Das erste aktive Modell ist die Vorgabe für neue Besucher im
            Story-Modus. Preise je 1 Mio. Token (Eingabe / Ausgabe) laut OpenRouter.
          </p>
          <Button type="button" size="sm" className="whitespace-nowrap shrink-0" disabled={!daten} onClick={() => setHinzufuegenOffen(true)} title="Modell hinzufügen">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Modell hinzufügen</span>
          </Button>
        </div>

        {ladeFehler && <p className="text-sm text-destructive">Liste nicht geladen: {ladeFehler}</p>}
        {!daten && !ladeFehler && <p className="text-sm text-muted-foreground">Lädt…</p>}
        {daten?.katalogFehler && (
          <p className="text-sm text-destructive">OpenRouter-Katalog nicht erreichbar, Preise fehlen: {daten.katalogFehler}</p>
        )}

        {daten && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pos.</TableHead>
                  <TableHead>Modell</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead>Kontext</TableHead>
                  <TableHead>Probe</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead><span className="sr-only">Bearbeiten</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelle.map((modell, index) => (
                  <ModellZeile
                    key={modell.modelId}
                    modell={modell}
                    position={index + 1}
                    istErste={index === 0}
                    istLetzte={index === modelle.length - 1}
                    beschaeftigt={beschaeftigt !== null}
                    onHoch={() => void ordnen(verschoben(modelle, index, index - 1))}
                    onRunter={() => void ordnen(verschoben(modelle, index, index + 1))}
                    onProbe={() => void probe(modell.modelId)}
                    onSchalter={(aktiv) => void aendern(modell.modelId, { isActive: aktiv })}
                    onBearbeiten={() => setBearbeiten(modell)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {beschaeftigt && <p className="text-xs text-muted-foreground">Arbeitet an {beschaeftigt}…</p>}
      </div>

      <ModellHinzufuegenDialog
        offen={hinzufuegenOffen}
        onOffenChange={setHinzufuegenOffen}
        onHinzufuegen={async (modelId) => (await hinzufuegen(modelId)) !== null}
      />
      <ModellBearbeitenDialog
        modell={bearbeiten}
        onSchliessen={() => setBearbeiten(null)}
        onSpeichern={async (modelId, aenderung) => (await aendern(modelId, aenderung)) !== null}
      />
    </TooltipProvider>
  )
}
