'use client'

/**
 * @fileoverview Zuklappbarer Bericht-Block im Werkbank-Detail (F9).
 *
 * @description
 * Der gerenderte `BERICHT.md` ist der laengste Abschnitt des Details — bei
 * „26.01 Klimamaßnahmen" allein rund 700 px. Wer abnimmt, will die offenen
 * Punkte sehen, nicht ihn (Wunsch Peter 24.08.2026). Deshalb zuklappbar, mit
 * gemerktem Zustand (`uiPanePrefsAtom`, reine UI-Praeferenz); zugeklappt wird
 * der Inhalt gar nicht erst geladen.
 *
 * @module components/library/agent-view
 */

import { useAtom } from 'jotai'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { uiPanePrefsAtom } from '@/atoms/ui-prefs-atom'
import { WerkbankBericht } from './werkbank-bericht'

export function WerkbankBerichtBlock({
  libraryId,
  folderId,
  veraltet,
}: {
  libraryId: string
  folderId: string
  veraltet: boolean
}) {
  const [prefs, setPrefs] = useAtom(uiPanePrefsAtom)
  const zu = prefs.werkbankBerichtZu

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setPrefs({ werkbankBerichtZu: !zu })}
        aria-expanded={!zu}
        className="flex w-full items-center gap-2 rounded py-0.5 text-sm font-semibold hover:bg-accent"
      >
        {zu ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        <span>Bericht</span>
        {zu && <span className="font-normal text-muted-foreground">zugeklappt</span>}
      </button>
      {!zu && <WerkbankBericht libraryId={libraryId} folderId={folderId} veraltet={veraltet} />}
    </section>
  )
}
