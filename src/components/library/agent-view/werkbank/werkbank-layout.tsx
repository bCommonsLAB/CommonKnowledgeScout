'use client'

/**
 * @fileoverview Master-Detail-Rahmen der Werkbank (W3, aus dem Panel extrahiert).
 *
 * @description
 * Desktop: ResizablePanelGroup mit gemerkter Listenbreite (`uiPanePrefsAtom`).
 * Mobil: gestapelt — Auswahl wechselt in die Detail-Ansicht, „Zur Liste"
 * fuehrt zurueck. Der Scroll-Container des Details sitzt INNEN:
 * react-resizable-panels setzt `overflow: hidden` als Inline-Style aufs
 * Panel, das jede overflow-Klasse schlaegt (Befund 24.08.2026 — 2342 px des
 * Details waren unerreichbar). Reine Anordnung, keine Semantik.
 *
 * @module components/library/agent-view
 */

import type { ReactNode } from 'react'
import { useAtom } from 'jotai'
import { ArrowLeft } from 'lucide-react'
import { uiPanePrefsAtom } from '@/atoms/ui-prefs-atom'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

export function WerkbankLayout({
  liste,
  detail,
  detailAktiv,
  onZurListe,
}: {
  liste: ReactNode
  detail: ReactNode
  /** Mobil: true zeigt das Detail statt der Liste. */
  detailAktiv: boolean
  onZurListe: () => void
}) {
  const [prefs, setPrefs] = useAtom(uiPanePrefsAtom)

  return (
    <>
      <div className="hidden min-h-0 flex-1 md:block">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full rounded-lg border"
          onLayout={(sizes) => setPrefs({ werkbankListeSize: sizes[0] })}
        >
          <ResizablePanel defaultSize={prefs.werkbankListeSize} minSize={20} className="min-h-0">
            {liste}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={100 - prefs.werkbankListeSize} minSize={30} className="min-h-0">
            {/* A3: das Dokument scrollt in SEINEM Bereich, der Kopf steht fest —
                der Scroll-Container bleibt INNEN (Befund 24.08.2026). */}
            <div className="flex h-full flex-col overflow-hidden">{detail}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border md:hidden">
        {!detailAktiv ? (
          liste
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b p-1">
              <Button variant="ghost" size="sm" onClick={onZurListe}>
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Zur Liste
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detail}</div>
          </div>
        )}
      </div>
    </>
  )
}
