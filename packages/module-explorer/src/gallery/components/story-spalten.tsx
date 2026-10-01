'use client'

/**
 * Die drei Spalten des Story-Reiters auf dem Desktop (D3): Chronik | Mitte |
 * Quellen, per Ziehen veraenderbar (Owner-Entscheidung 2, 01.10.2026),
 * Startwerte 15 / 50 / 35, Stand im localStorage (`autoSaveId` von
 * react-resizable-panels, wie die Archiv-Panels in `library.tsx`).
 *
 * Ohne Chronik-Slot zwei Spalten 50 / 50 unter eigenem Schluessel, damit der
 * gemerkte Stand des einen Layouts das andere nicht verzerrt. Mobil kommt
 * hier nicht vorbei: dort fuellt die Mitte den Schirm (D4 ordnet den Rest).
 */

import type { ReactNode } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@ks/ui'

export interface StorySpaltenProps {
  chronik?: ReactNode
  mitte: ReactNode
  quellen: ReactNode
}

export function StorySpalten({ chronik, mitte, quellen }: StorySpaltenProps) {
  const mitChronik = chronik !== undefined
  const schluessel = mitChronik ? 'story-spalten-3' : 'story-spalten-2'
  return (
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
      <ResizablePanel id="mitte" order={2} defaultSize={50} minSize={30} className="min-h-0">
        <div className="flex h-full flex-col overflow-hidden rounded-md">{mitte}</div>
      </ResizablePanel>
      <ResizableHandle withHandle className="mx-1 bg-transparent" />
      <ResizablePanel id="quellen" order={3} defaultSize={mitChronik ? 35 : 50} minSize={20} className="min-h-0">
        <div className="flex h-full flex-col overflow-hidden rounded-md" data-story-quellen>
          {quellen}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
