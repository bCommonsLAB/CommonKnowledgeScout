'use client'

/**
 * Die drei Spalten des Story-Reiters auf dem Desktop (D3): Chronik | Mitte |
 * Quellen, per Ziehen veraenderbar (Owner-Entscheidung 2, 01.10.2026),
 * Startwerte 15 / 50 / 35, Stand im localStorage (`autoSaveId` von
 * react-resizable-panels, wie die Archiv-Panels in `library.tsx`).
 *
 * D11b: Die Quellen sind ein fliegendes Verzeichnis — eingeklappt eine
 * schmale Leiste (`QuellenLeiste`) rechts, die Mitte bekommt den Platz;
 * aufgeklappt die Spalte wie bisher mit einem Pfeil zum Einklappen. Ohne
 * `leiste` (Embed) bleibt die Spalte immer offen.
 *
 * Ohne Chronik-Slot zwei Spalten 50 / 50 unter eigenem Schluessel, damit der
 * gemerkte Stand des einen Layouts das andere nicht verzerrt. Mobil kommt
 * hier nicht vorbei: dort fuellt die Mitte den Schirm (D4 ordnet den Rest).
 */

import type { ReactNode } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@ks/ui'
import { QuellenEinklappen, QuellenLeiste } from './quellen-leiste'

export interface StorySpaltenLeiste {
  offen: boolean
  onToggle: () => void
  /** Zahl auf der Leiste: Belege der aktiven Antwort oder Quellen im Bestand. */
  zaehler: number
  belege: boolean
}

export interface StorySpaltenProps {
  chronik?: ReactNode
  mitte: ReactNode
  quellen: ReactNode
  /** D11b: Zustand der Quellenspalte; ohne Angabe immer offen. */
  leiste?: StorySpaltenLeiste
}

export function StorySpalten({ chronik, mitte, quellen, leiste }: StorySpaltenProps) {
  const mitChronik = chronik !== undefined
  const quellenOffen = leiste === undefined || leiste.offen
  // Eigener Schluessel je Spaltenzahl (Chronik ja/nein), damit sich die gemerkten
  // Breiten nicht verzerren. Die Quellenspalte wechselt OHNE neuen Schluessel:
  // Ein Schluesselwechsel baute Chronik und Mitte neu auf (Uebersicht lief
  // erneut an). react-resizable-panels verkraftet das Ein- und Ausblenden
  // eines Panels ueber `id`/`order`.
  const schluessel = mitChronik ? 'story-spalten-3' : 'story-spalten-2'
  return (
    <div className="flex flex-1 min-h-0 gap-1">
      <ResizablePanelGroup key={schluessel} direction="horizontal" autoSaveId={schluessel} className="flex-1 min-h-0">
        {mitChronik && (
          <>
            <ResizablePanel id="chronik" order={1} defaultSize={15} minSize={10} className="min-h-0">
              <div className="flex h-full flex-col overflow-hidden rounded-md border bg-muted/20" data-story-chronik>
                {chronik}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="mx-1 bg-transparent" />
          </>
        )}
        <ResizablePanel id="mitte" order={2} defaultSize={quellenOffen ? 50 : 85} minSize={30} className="min-h-0">
          <div className="flex h-full flex-col overflow-hidden rounded-md">{mitte}</div>
        </ResizablePanel>
        {quellenOffen && (
          <>
            <ResizableHandle withHandle className="mx-1 bg-transparent" />
            <ResizablePanel id="quellen" order={3} defaultSize={mitChronik ? 35 : 50} minSize={20} className="min-h-0">
              <div className="flex h-full flex-col overflow-hidden rounded-md" data-story-quellen>
                {leiste && (
                  <div className="flex shrink-0 justify-end px-1 pb-1">
                    <QuellenEinklappen onClick={leiste.onToggle} />
                  </div>
                )}
                {quellen}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {leiste && !leiste.offen && <QuellenLeiste zaehler={leiste.zaehler} belege={leiste.belege} onOeffnen={leiste.onToggle} />}
    </div>
  )
}
