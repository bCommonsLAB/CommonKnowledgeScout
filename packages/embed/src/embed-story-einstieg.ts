'use client'

/**
 * Einstieg mit einer Frage (Plan `startseite-als-embed`, WE0): die Sitzung der
 * Frage aufloesen.
 *
 * Gegenstueck zu `StoryAuswahlUrl` der App, ohne Adresszeile. Die Auswahl
 * (`storyAuswahlAtom`) setzt schon der Speicher beim Montieren
 * (`knowledge-scout-explorer.tsx`). Gehoert die Frage zu einer anderen Sitzung
 * als der zuletzt aktiven (im localStorage je Library), bliebe die Mitte leer:
 * Darum fragt dieser Hook die Instanz nach der Sitzung der Frage
 * (`GET …/queries/<queryId>` liefert `chatId`, anonym ueber `X-Session-ID`) und
 * stellt die aktive Sitzung darauf um. Ist die Frage nicht auffindbar, bleibt
 * sie gewaehlt; die Mitte meldet sie sichtbar als „nicht im Verlauf".
 */

import { useEffect, useRef } from 'react'
import { useSessionHeaders, type InstanceApi } from '@ks/api-client'
import { useStorySitzungId } from '@ks/module-story/react'

export function useStoryEinstieg(libraryId: string, frage: string | undefined, instanz: InstanceApi): void {
  const { chatId, setChatId, gelesen } = useStorySitzungId(libraryId)
  // Im Embed ist niemand angemeldet: die anonyme Sitzungskennung des Browsers.
  const sessionHeaders = useSessionHeaders(false)
  const chatIdRef = useRef(chatId)
  chatIdRef.current = chatId

  useEffect(() => {
    // Erst, wenn die gespeicherte Sitzung gelesen ist — sonst ist `chatId` nur vorlaeufig leer.
    if (!frage || !libraryId || !gelesen) return
    let aktuell = true
    const pfad = `/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(frage)}`
    const headers = Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined
    instanz
      .fetch(pfad, { headers, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          console.warn('[KnowledgeScoutExplorer] Frage aus dem Einstieg nicht auffindbar', { frage, status: res.status })
          return
        }
        const log = (await res.json()) as { chatId?: unknown }
        if (!aktuell) return
        if (typeof log.chatId !== 'string' || log.chatId === '') {
          console.warn('[KnowledgeScoutExplorer] Gespeicherte Frage ohne Sitzung', { frage })
          return
        }
        if (log.chatId !== chatIdRef.current) setChatId(log.chatId)
      })
      .catch((error: unknown) => {
        if (aktuell) console.warn('[KnowledgeScoutExplorer] Sitzung der Frage nicht aufloesbar', { frage, error })
      })
    return () => {
      aktuell = false
    }
  }, [frage, libraryId, gelesen, instanz, sessionHeaders, setChatId])
}
