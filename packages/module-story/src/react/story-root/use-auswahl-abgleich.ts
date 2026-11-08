/**
 * Abgleich der Konversations-Auswahl mit dem Verlauf (aus `useStoryKonversation`
 * herausgeloest, 08.11.2026).
 *
 * 1. Nachtragen: Sobald die gesendete Frage ihre gespeicherte Kennung hat,
 *    traegt die Auswahl `queryId` und Thema nach (die App schreibt die Kennung
 *    in die Adresse, D2).
 * 2. Rueckfall: Eine Auswahl, die nur eine LOKALE Frage-Kennung traegt und im
 *    fertig geladenen Verlauf dieser Sitzung nicht vorkommt, stammt aus einem
 *    anderen Gastgeber (Startseite → Story-Modus, waehrend die Frage noch
 *    lief). Dieser Hook kennt die Nachricht nicht und kann sie nie bekommen —
 *    statt dauerhaft „nicht im geladenen Verlauf" zeigt die Mitte das juengste
 *    Paar der Sitzung, sonst die Uebersicht. Laut im Log, nicht still.
 *    Eine gespeicherte Kennung (`queryId`), die fehlt, bleibt gewaehlt und
 *    sichtbar gemeldet (geteilter Link, D2) — kein Rueckfall.
 */

import { useEffect } from 'react'
import type { StoryTopicsData } from '@ks/contracts'
import { themaZuFrage } from '../thema-zu-frage'
import type { StoryAuswahl } from '../types'
import type { Nachricht } from '../konversation/types'
import { auswahlRueckfall, frageZurAuswahl } from '../konversation/verlauf'

export interface UseAuswahlAbgleichParams {
  auswahl: StoryAuswahl
  setAuswahl: (auswahl: StoryAuswahl) => void
  nachrichten: Nachricht[]
  gliederung: StoryTopicsData | null
  /** Eine Frage laeuft gerade — ihre Nachricht ist lokal, kein Rueckfall. */
  laeuft: boolean
  verlaufLadend: boolean
  /** Sitzung, fuer die der Verlauf zuletzt fertig geladen wurde (`useStoryVerlauf`). */
  geladenFuer: string | null
  chatId: string | null
  /** Die gespeicherte Sitzungskennung ist gelesen (`useStorySitzungId`) — vorher ist `chatId` nur vorlaeufig null. */
  sitzungGelesen: boolean
}

export function useAuswahlAbgleich(p: UseAuswahlAbgleichParams): void {
  const { auswahl, setAuswahl, nachrichten, gliederung, laeuft, verlaufLadend, geladenFuer, chatId, sitzungGelesen } = p

  // Gespeicherte Kennung und Thema nachtragen, sobald bekannt.
  useEffect(() => {
    if (auswahl.art !== 'konversation') return
    const frage = frageZurAuswahl(nachrichten, auswahl)
    if (!frage) return
    const queryId = auswahl.queryId ?? frage.queryId
    const themaId = auswahl.themaId ?? themaZuFrage(gliederung, frage.text) ?? undefined
    if (queryId !== auswahl.queryId || themaId !== auswahl.themaId) setAuswahl({ ...auswahl, queryId, themaId })
  }, [auswahl, nachrichten, gliederung, setAuswahl])

  // Rueckfall erst, wenn der Verlauf DIESER Sitzung fertig geladen ist — vorher
  // waere jede Auswahl kurz unaufloesbar (Montage, Sitzungswechsel).
  useEffect(() => {
    if (!sitzungGelesen || laeuft || verlaufLadend || geladenFuer !== chatId) return
    const neu = auswahlRueckfall(nachrichten, auswahl)
    if (!neu) return
    console.warn('[useStoryKonversation] Auswahl nicht im geladenen Verlauf — Rueckfall', {
      frageId: auswahl.art === 'konversation' ? auswahl.frageId : undefined,
      chatId,
      rueckfall: neu,
    })
    setAuswahl(neu)
  }, [auswahl, nachrichten, laeuft, verlaufLadend, geladenFuer, chatId, sitzungGelesen, setAuswahl])
}
