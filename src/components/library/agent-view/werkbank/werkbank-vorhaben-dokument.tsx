'use client'

/**
 * @fileoverview Vorhaben als Dokument: Bericht · Ordner-Beschreibung · Protokoll.
 *
 * @description
 * Mockup Zustand A: rechts steht genau EIN Dokument. Die frueheren
 * gestapelten Bloecke (Bericht · Befunde · Twin-Familien) entfallen — die
 * Befunde werden Kennzeichnung am Baum und Inhalt des Kopfes (A4), die
 * Familien SIND die Artefakt-Ebene des Baums (A2). Beide Tabs rendern ueber
 * den bestehenden `WerkbankBericht` (W2-Route, `datei=bericht|index`).
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { WerkbankBericht } from './werkbank-bericht'
import { WerkbankProtokoll } from './werkbank-protokoll'

type VorhabenTab = 'bericht' | 'beschreibung' | 'protokoll'

export function WerkbankVorhabenDokument({ libraryId, folderId, veraltet }: {
  libraryId: string
  folderId: string
  /** `bericht_veraltet`-Befund am Vorhabensordner (aus dem Report). */
  veraltet: boolean
}) {
  const [tab, setTab] = useState<VorhabenTab>('bericht')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex gap-1 border-b px-3 pt-1">
        {([['bericht', 'Bericht'], ['beschreibung', 'Ordner-Beschreibung'], ['protokoll', 'Protokoll']] as const).map(([wert, label]) => (
          <button
            key={wert}
            role="tab"
            type="button"
            aria-selected={tab === wert}
            onClick={() => setTab(wert)}
            className={`rounded-t-md border border-b-0 px-3 py-1 text-xs ${tab === wert ? 'bg-background font-medium' : 'border-transparent text-muted-foreground hover:bg-accent'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'bericht' && (
          <WerkbankBericht libraryId={libraryId} folderId={folderId} veraltet={veraltet} />
        )}
        {tab === 'beschreibung' && (
          <WerkbankBericht libraryId={libraryId} folderId={folderId} veraltet={false} datei="index" />
        )}
        {tab === 'protokoll' && <WerkbankProtokoll libraryId={libraryId} folderId={folderId} />}
      </div>
    </div>
  )
}
