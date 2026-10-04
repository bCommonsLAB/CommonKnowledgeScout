'use client'

/**
 * Die Spalten des Story-Reiters auf dem Desktop (D3): Chronik | Mitte, per
 * Ziehen veraenderbar (Owner-Entscheidung 2, 01.10.2026), Stand im
 * localStorage (`autoSaveId` von react-resizable-panels, wie die
 * Archiv-Panels in `library.tsx`).
 *
 * D11b (Owner 02.10.): Die Quellen sind ein fliegendes Verzeichnis. Zu:
 * eine schmale Leiste (`QuellenLeiste`) am rechten Rand, Chronik und Mitte
 * teilen sich die Breite (Chronik breiter als frueher, damit die Fragen
 * lesbar sind). Auf: die Quellen legen sich als Schicht ueber den rechten
 * Teil der Mitte — die Breiten der anderen Spalten aendern sich dabei NICHT.
 * Ohne `leiste` (Embed) bleibt die alte Dreiteilung mit fester Quellenspalte.
 *
 * Mobil kommt hier nicht vorbei: dort fuellt die Mitte den Schirm (D4).
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
  /** D11b: Zustand des fliegenden Quellenverzeichnisses; ohne Angabe feste Spalte. */
  leiste?: StorySpaltenLeiste
}

export function StorySpalten({ chronik, mitte, quellen, leiste }: StorySpaltenProps) {
  const mitChronik = chronik !== undefined
  const fliegend = leiste !== undefined
  // Eigener Schluessel je Layout, damit sich die gemerkten Breiten nicht verzerren.
  const schluessel = fliegend ? (mitChronik ? 'story-spalten-fliegend-2' : 'story-spalten-fliegend-1') : mitChronik ? 'story-spalten-3' : 'story-spalten-2'
  const chronikBreite = fliegend ? 22 : 15

  const gruppe = (
    <ResizablePanelGroup key={schluessel} direction="horizontal" autoSaveId={schluessel} className="flex-1 min-h-0">
      {mitChronik && (
        <>
          <ResizablePanel id="chronik" order={1} defaultSize={chronikBreite} minSize={12} className="min-h-0">
            <div className="flex h-full flex-col overflow-hidden rounded-md border bg-muted/20" data-story-chronik>
              {chronik}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-1 bg-transparent" />
        </>
      )}
      <ResizablePanel id="mitte" order={2} defaultSize={fliegend ? 100 - chronikBreite : 50} minSize={30} className="min-h-0">
        <div className="flex h-full flex-col overflow-hidden rounded-md">{mitte}</div>
      </ResizablePanel>
      {!fliegend && (
        <>
          <ResizableHandle withHandle className="mx-1 bg-transparent" />
          <ResizablePanel id="quellen" order={3} defaultSize={mitChronik ? 35 : 50} minSize={20} className="min-h-0">
            <div className="flex h-full flex-col overflow-hidden rounded-md" data-story-quellen>
              {quellen}
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  )

  if (!fliegend) return gruppe

  return (
    <div className="relative flex flex-1 min-h-0 gap-1">
      {gruppe}
      {/* Die Leiste bleibt auch offen (unsichtbar) stehen: So aendern sich die Breiten von Chronik und Mitte nicht. */}
      <QuellenLeiste zaehler={leiste.zaehler} belege={leiste.belege} onOeffnen={leiste.onToggle} unsichtbar={leiste.offen} />
      {leiste.offen && (
        <aside
          className="absolute inset-y-0 right-0 z-20 flex w-[min(480px,55%)] flex-col overflow-hidden rounded-md border bg-background shadow-xl"
          aria-label="Quellen"
          data-story-quellen
          data-fliegend
        >
          <div className="flex shrink-0 justify-end px-1 pt-1">
            <QuellenEinklappen onClick={leiste.onToggle} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{quellen}</div>
        </aside>
      )}
    </div>
  )
}
