/**
 * Bruecke zwischen Chat-Verlauf und Story-Dreiteilung (D1/D2; D6 aus
 * chat-panel.tsx ausgegliedert, Verhalten 1:1).
 *
 * Die Chronik links haengt als eigener Slot im Story-Reiter; geteilt wird
 * ueber die drei Story-Atome: Auswahl (was die Mitte zeigt), Gliederung
 * (die Themenuebersicht) und die Fragen der aktiven Sitzung aus dem Verlauf.
 * Nur eingebettet aktiv; im Chat-Reiter liefert die Bruecke den Verlauf
 * unveraendert als „Konversation".
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import type { StoryTopicsData } from '@ks/contracts'
import { storyAktiveSitzungAtom, storyAuswahlAtom, storyGliederungAtom, themaZuFrage, type StoryAuswahl } from '@ks/module-story/react'
import { groupMessagesToConversations, type ChatMessage } from '../../utils/chat-utils'
import { fragenAusVerlauf, frageZurAuswahl, konversationAuswaehlen, neueFrage } from '../../utils/chronik-utils'

export interface UseStoryAuswahlBridgeParams {
  isEmbedded: boolean
  messages: ChatMessage[]
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  activeChatId: string | null
  isSending: boolean
  gliederung: StoryTopicsData | null
  setOpenConversations: Dispatch<SetStateAction<Set<string>>>
}

export interface UseStoryAuswahlBridgeResult {
  storyAuswahl: StoryAuswahl
  setStoryAuswahl: (auswahl: StoryAuswahl) => void
  /** Eingebettet nur die gewaehlte Konversation; sonst der ganze Verlauf. */
  konversation: ChatMessage[]
  /** Schluessel fuer den Scroll (D2): erst, wenn die Konversation gerendert ist. */
  gewaehlteKonversation: string | null
}

export function useStoryAuswahlBridge({
  isEmbedded,
  messages,
  setMessages,
  activeChatId,
  isSending,
  gliederung,
  setOpenConversations,
}: UseStoryAuswahlBridgeParams): UseStoryAuswahlBridgeResult {
  const [storyAuswahl, setStoryAuswahl] = useAtom(storyAuswahlAtom)
  const setStoryGliederung = useSetAtom(storyGliederungAtom)
  const setStoryAktiveSitzung = useSetAtom(storyAktiveSitzungAtom)

  useEffect(() => {
    if (isEmbedded) setStoryGliederung(gliederung)
  }, [isEmbedded, gliederung, setStoryGliederung])

  useEffect(() => {
    if (isEmbedded) setStoryAktiveSitzung({ chatId: activeChatId, fragen: fragenAusVerlauf(messages, isSending) })
  }, [isEmbedded, activeChatId, messages, isSending, setStoryAktiveSitzung])

  // Klickmodell: „Frage tippen oder eigene senden" → die neue Frage wird die
  // aktive Konversation; ihr Thema (falls aus einem Thema gewaehlt) markiert
  // die Gliederung. Ein Verlaufs-Laden bringt viele Nachrichten auf einmal
  // und loest das nicht aus (neueFrage).
  const vorherigeNachrichtenRef = useRef(messages.length)
  useEffect(() => {
    const frage = isEmbedded ? neueFrage(vorherigeNachrichtenRef.current, messages) : null
    vorherigeNachrichtenRef.current = messages.length
    if (frage) {
      setStoryAuswahl({ art: 'konversation', frageId: frage.id, themaId: themaZuFrage(gliederung, frage.content) ?? undefined })
    }
  }, [isEmbedded, messages, gliederung, setStoryAuswahl])

  // „Neue Sitzung" in der Chronik loest die aktive Sitzung: Der Verlauf der
  // alten Sitzung gehoert nicht in die neue (use-chat-history behaelt ihn sonst).
  const vorherigeChatIdRef = useRef(activeChatId)
  useEffect(() => {
    if (isEmbedded && vorherigeChatIdRef.current !== null && activeChatId === null) setMessages([])
    vorherigeChatIdRef.current = activeChatId
  }, [isEmbedded, activeChatId, setMessages])

  // D2: Sobald die laufende Frage ihre gespeicherte Kennung hat, traegt die
  // Auswahl sie nach — die App schreibt sie dann in die Adresse (`q=`). Kam
  // die Auswahl aus der Adresse, fehlt ihr das Thema: aus dem Fragetext ergaenzen.
  useEffect(() => {
    if (!isEmbedded || storyAuswahl.art !== 'konversation') return
    const frage = frageZurAuswahl(messages, storyAuswahl)
    if (!frage) return
    const queryId = storyAuswahl.queryId ?? frage.queryId
    const themaId = storyAuswahl.themaId ?? themaZuFrage(gliederung, frage.content) ?? undefined
    if (queryId !== storyAuswahl.queryId || themaId !== storyAuswahl.themaId) {
      setStoryAuswahl({ ...storyAuswahl, queryId, themaId })
    }
  }, [isEmbedded, storyAuswahl, messages, gliederung, setStoryAuswahl])

  // Die Mitte zeigt genau die gewaehlte Konversation — aufgeklappt.
  const konversation = isEmbedded ? konversationAuswaehlen(messages, storyAuswahl) : messages
  const gewaehlteKonversation =
    isEmbedded && storyAuswahl.art === 'konversation' && konversation.length > 0
      ? (storyAuswahl.frageId ?? storyAuswahl.queryId ?? null)
      : null
  useEffect(() => {
    if (!isEmbedded || storyAuswahl.art !== 'konversation') return
    const paar = groupMessagesToConversations(konversationAuswaehlen(messages, storyAuswahl))[0]
    if (paar) {
      setOpenConversations((prev) => (prev.has(paar.conversationId) ? prev : new Set([...prev, paar.conversationId])))
    }
  }, [isEmbedded, storyAuswahl, messages, setOpenConversations])

  return { storyAuswahl, setStoryAuswahl, konversation, gewaehlteKonversation }
}
