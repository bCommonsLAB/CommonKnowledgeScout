'use client'

/**
 * Frage aus der Themen-Sektion (`layout=topics`, 18.11.2026) an die Story-Sektion:
 * einmal annehmen, zur Sektion hinaufrollen, stellen. Laeuft noch eine Antwort, steht
 * die Frage im Feld und geht nicht verloren (`auftragSchritt`). Aus
 * `website-story-sektion.tsx` herausgeloest (24.11.2026, Dateigrenze).
 */

import * as React from 'react'
import { useAtom } from 'jotai'
import { auftragSchritt } from '..'
import { websiteStoryFrageAtom } from './website-story-frage-atom'

export function useFrageAuftrag(
  anker: React.RefObject<HTMLElement | null>,
  lage: { laedt: boolean; fehler: boolean; laeuft: boolean },
  senden: (frage: string) => void,
  eintragen: (frage: string) => void,
): void {
  const [auftrag, setAuftrag] = useAtom(websiteStoryFrageAtom)
  const { laedt, fehler, laeuft } = lage
  React.useEffect(() => {
    if (!auftrag) return
    const schritt = auftragSchritt({ laedt, fehler, laeuft })
    if (schritt === 'warten') return
    setAuftrag(null)
    if (schritt === 'verwerfen') {
      console.error('[WebsiteStorySektion] Frage aus der Themenuebersicht verworfen — die Sektion zeigt einen Fehler', auftrag.text)
      return
    }
    anker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (schritt === 'eintragen') eintragen(auftrag.text)
    else senden(auftrag.text)
  }, [auftrag, laedt, fehler, laeuft, setAuftrag, senden, eintragen, anker])
}
