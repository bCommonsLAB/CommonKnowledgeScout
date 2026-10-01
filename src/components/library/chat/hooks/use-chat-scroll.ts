import { useEffect, useRef, RefObject } from 'react'
import type { ChatMessage } from '../utils/chat-utils'
import { groupMessagesToConversations } from '../utils/chat-utils'
import type { ChatProcessingStep } from '@/types/chat-processing'

/** Abstand (px) zwischen Viewport-Oberkante und Frage-Oberkante. */
const SCROLL_TOP_OFFSET_PX = 8

/**
 * Scrollt den naechsten Scroll-Viewport so, dass `el` oben buendig steht.
 *
 * Bewusst NICHT `scrollIntoView`: das scrollt auch das Fenster mit, und mit
 * `block: 'nearest'` landete eine kurze Antwort unten im Viewport, die
 * Themenuebersicht darueber (Befund 01.10.2026). Gewollt ist: Frage oben,
 * Antwort darunter — bei jeder Antwortlaenge gleich.
 *
 * Bewusst NICHT `behavior: 'smooth'`: waehrend die Antwort streamt, waechst
 * der Inhalt, und Chrome bricht eine laufende weiche Scroll-Animation dabei
 * ab — die Frage blieb dann mitten im Fenster stehen (Messung 01.10.2026,
 * Frage bei 393 px statt 8 px). Sofortiges Setzen ist stabil.
 */
export function scrollElementToViewportTop(el: Element): void {
  const viewport = el.closest('[data-radix-scroll-area-viewport]')
  if (!(viewport instanceof HTMLElement)) return
  // Platzhalter unter dem Verlauf: Solange die Antwort fehlt oder kurz ist,
  // reicht der Inhalt nicht, um die letzte Frage nach oben zu schieben — der
  // Bereich scrollt nur bis zum Ende. Der Platzhalter fuellt genau die Luecke
  // (Fensterhoehe minus Hoehe der Konversation) und schrumpft, sobald die
  // Antwort waechst. Fehlt er im DOM, laeuft der Scroll ohne ihn.
  const spacer = viewport.querySelector('[data-chat-scroll-spacer]')
  if (spacer instanceof HTMLElement) {
    const gap = viewport.clientHeight - el.getBoundingClientRect().height - SCROLL_TOP_OFFSET_PX
    spacer.style.height = `${Math.max(0, Math.round(gap))}px`
  }
  const top =
    el.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - SCROLL_TOP_OFFSET_PX
  viewport.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
}

/** Letzte Konversation (ohne Themenuebersicht) im Scroll-Bereich finden. */
function findLastConversationElement(root: HTMLElement): Element | null {
  const all = Array.from(root.querySelectorAll('[data-conversation-id]')).filter(
    (el) => el.getAttribute('data-conversation-id') !== 'toc',
  )
  return all.length > 0 ? all[all.length - 1] : null
}

interface UseChatScrollProps {
  scrollRef: RefObject<HTMLDivElement>
  messages: ChatMessage[]
  openConversations: Set<string>
  setOpenConversations: React.Dispatch<React.SetStateAction<Set<string>>>
  isSending: boolean
  processingSteps: ChatProcessingStep[]
  prevMessagesLengthRef: React.MutableRefObject<number>
  /**
   * D2 (Story-Modus): Schluessel der in der Mitte gewaehlten Konversation,
   * sobald sie gerendert ist; `null` ohne Auswahl. Ein Wechsel stellt die
   * Frage oben buendig — dieselbe Regel wie beim Senden.
   */
  gewaehlteKonversation?: string | null
}

/**
 * Custom Hook für Auto-Scroll-Logik im ChatPanel
 * 
 * Verwaltet automatisches Scrollen zu:
 * - Neuesten Nachrichten
 * - Verarbeitungsstatus während des Sendens
 * - Anfang der Antworten
 */
export function useChatScroll({
  scrollRef,
  messages,
  openConversations,
  setOpenConversations,
  isSending,
  processingSteps,
  prevMessagesLengthRef,
  gewaehlteKonversation = null,
}: UseChatScrollProps) {
  // Auto-Scroll zum neuesten Accordion wurde deaktiviert - Benutzer möchte nicht automatisch scrollen
  // Aktualisiere nur prevMessagesLengthRef, damit andere Logik weiterhin funktioniert
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]) // prevMessagesLengthRef ist ein Ref und muss nicht in Dependencies sein

  // Auto-Scroll beim Start des Sendens: die neue Frage oben buendig stellen.
  // Vorher wurde "ans Ende" gescrollt — dann stand die Frage unten im Fenster
  // und die Themenuebersicht fuellte den Rest (Befund 01.10.2026). Der
  // Verarbeitungsstatus haengt direkt unter der Frage und bleibt so sichtbar.
  useEffect(() => {
    if (!isSending) return
    const scrollToQuestion = () => {
      if (!scrollRef.current) return
      const el = findLastConversationElement(scrollRef.current)
      if (el) scrollElementToViewportTop(el)
    }
    // Sofort und nochmal nach kurzer Verzoegerung (Frage ist dann sicher gerendert)
    scrollToQuestion()
    const timeoutId = setTimeout(scrollToQuestion, 200)
    return () => clearTimeout(timeoutId)
  }, [isSending, scrollRef])

  // D2: Auswahl gewechselt (Chronik-Klick, Zurueck-Knopf, Neu laden mit `q=`)
  // → die gewaehlte Konversation steht allein in der Mitte; ihre Frage oben
  // buendig stellen, nach dem Rendern (ein Frame), sonst misst der Platzhalter
  // noch den alten Inhalt.
  useEffect(() => {
    if (!gewaehlteKonversation) return
    const frame = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector('[data-conversation-id]')
      if (el) scrollElementToViewportTop(el)
    })
    return () => cancelAnimationFrame(frame)
  }, [gewaehlteKonversation, scrollRef])

  // Waehrend der Verarbeitung wird bewusst NICHT mehr nachgescrollt: die
  // Frage bleibt oben stehen, der Status darunter waechst nach unten.
  // (processingSteps bleibt in der Signatur, damit Aufrufer unveraendert bleiben.)
  void processingSteps

  // Auto-Scroll wenn neue Antworten hinzugefügt werden - scrollt zum Anfang der Antwort
  // Öffne nur, wenn die Antwort wirklich neu ist und noch nie automatisch geöffnet wurde
  const openedAnswersRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    // Prüfe, ob es eine neue Antwort gibt
    const conversations = groupMessagesToConversations(messages)
    const lastConversation = conversations[conversations.length - 1]
    
    if (lastConversation?.answer) {
      const answerId = lastConversation.answer.id
      const answerMessageIndex = messages.findIndex(m => m.id === answerId)
      const isNewlyAdded = answerMessageIndex === messages.length - 1
      const isFromHistory = lastConversation.answer.queryId && !isNewlyAdded

      // Nur öffnen, wenn Antwort neu ist und noch nicht automatisch geöffnet wurde
      const shouldAutoOpen = isNewlyAdded && !isFromHistory && !openedAnswersRef.current.has(answerId)

      if (shouldAutoOpen && !openConversations.has(lastConversation.conversationId)) {
        openedAnswersRef.current.add(answerId)
        setOpenConversations(prev => new Set([...prev, lastConversation.conversationId]))
      }
      
      // Auto-Scroll wurde deaktiviert - Benutzer möchte nicht automatisch scrollen
    }
  }, [messages, openConversations, setOpenConversations])
}

