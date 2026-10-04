'use client'

/**
 * Die Auswahl des Story-Modus in der Adresse (D2): `q=<queryId>`.
 *
 * Gegenstueck zu `NextGalleryNavigation`: Das Paket `@ks/module-story` haelt
 * die Auswahl in `storyAuswahlAtom` und kennt keine Adresszeile; diese
 * Bruecke bindet das Atom per `nuqs` an `q`. Fehlt `q`, gilt die
 * Themenuebersicht; ein Thema und eine noch laufende Frage stehen nicht in
 * der Adresse (`auswahl-kennung.ts` im Paket legt die Regeln fest).
 *
 * Kommt `q` von aussen (Neu laden, Zurueck-Knopf, geteilter Link), gehoert
 * die Konversation womoeglich zu einer anderen Sitzung als der zuletzt
 * aktiven (localStorage). Dann wird die Sitzung ueber die gespeicherte Frage
 * aufgeloest (`GET …/queries/<queryId>` liefert `chatId`) und der Chat
 * darauf umgestellt; sonst bliebe die Mitte leer. Eine nicht aufloesbare
 * Kennung bleibt gewaehlt und sichtbar gemeldet (Mitte: „nicht im Verlauf").
 *
 * Rendert nichts; montiert im Story-Reiter neben dem Chat-Panel.
 */

import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai'
import { parseAsString, useQueryState } from 'nuqs'
import {
  auswahlAusKennung,
  auswahlZuKennung,
  istNachtrag,
  storyAuswahlAtom,
  type StoryAuswahl,
} from '@ks/module-story/react'
import { useActiveChatId } from '@/components/library/chat/chat-panel/hooks/use-active-chat-id'
import { useClerkSessionHeaders } from '@/hooks/use-clerk-session-headers'

export function StoryAuswahlUrl({ libraryId }: { libraryId: string }) {
  const [q, setQ] = useQueryState('q', parseAsString)
  const [auswahl, setAuswahl] = useAtom(storyAuswahlAtom)
  const { activeChatId, setActiveChatId } = useActiveChatId(libraryId)
  const sessionHeaders = useClerkSessionHeaders()

  // `undefined`: noch nie gelaufen — beim ersten Lauf hat die Adresse Vorrang.
  const vorherQ = useRef<string | null | undefined>(undefined)
  const vorherAuswahl = useRef<StoryAuswahl>(auswahl)
  /** Kennung, die von aussen kam und deren Sitzung noch aufzuloesen ist. */
  const [aufzuloesen, setAufzuloesen] = useState<string | null>(null)

  useEffect(() => {
    const qGeaendert = vorherQ.current === undefined || vorherQ.current !== q
    const alteAuswahl = vorherAuswahl.current
    const auswahlGeaendert = alteAuswahl !== auswahl
    vorherQ.current = q
    vorherAuswahl.current = auswahl

    if (qGeaendert) {
      // Adresse → Auswahl (auch nach eigenem Schreiben: dann aendert sich nichts).
      const neu = auswahlAusKennung(q, auswahl)
      if (neu) {
        setAuswahl(neu)
        if (q !== null) setAufzuloesen(q)
      }
      return
    }
    if (auswahlGeaendert) {
      // Auswahl → Adresse: Klick mit Verlaufseintrag; der Nachtrag der
      // gespeicherten Kennung an eine laufende Frage ersetzt nur.
      const soll = auswahlZuKennung(auswahl)
      if (soll !== q) void setQ(soll, { history: istNachtrag(alteAuswahl, auswahl) ? 'replace' : 'push' })
    }
  }, [q, auswahl, setAuswahl, setQ])

  const activeChatIdRef = useRef(activeChatId)
  activeChatIdRef.current = activeChatId

  useEffect(() => {
    if (aufzuloesen === null) return
    let aktuell = true
    const queryId = aufzuloesen
    const laden = async () => {
      try {
        const res = await fetch(
          `/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`,
          { headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined, cache: 'no-store' },
        )
        if (!aktuell) return
        if (!res.ok) {
          console.warn('[StoryAuswahlUrl] Konversation aus der Adresse nicht auffindbar', { queryId, status: res.status })
          return
        }
        const log = (await res.json()) as { chatId?: unknown }
        if (!aktuell) return
        if (typeof log.chatId !== 'string' || log.chatId === '') {
          console.warn('[StoryAuswahlUrl] Gespeicherte Frage ohne Sitzung', { queryId })
          return
        }
        if (log.chatId !== activeChatIdRef.current) setActiveChatId(log.chatId)
      } catch (error) {
        if (aktuell) console.warn('[StoryAuswahlUrl] Sitzung zur Konversation nicht aufloesbar', { queryId, error })
      } finally {
        if (aktuell) setAufzuloesen((v) => (v === queryId ? null : v))
      }
    }
    void laden()
    return () => {
      aktuell = false
    }
  }, [aufzuloesen, libraryId, sessionHeaders, setActiveChatId])

  return null
}
