/**
 * Frage an den Chat-Stream schicken und die Antwort einsammeln (D6b; wie
 * `use-chat-stream` der App, aber ueber die Instanz und ohne Clerk).
 *
 * Eine Frage wird sofort als lokale Nachricht eingetragen; jeder SSE-Schritt
 * landet in `schritte` (die Oberflaeche zeigt sie in einfachen Worten, D2);
 * `complete` bringt Antwort, Belege, Anschlussfragen, Kurztitel (D5) und die
 * Sitzungskennung. Die Themenuebersicht laeuft ueber denselben Weg
 * (`uebersichtLaden`), kommt aber nicht in den Verlauf, sondern als
 * `storyTopicsData` an den Rueckruf. Ein Fehler entfernt die Frage wieder
 * und wird gemeldet — nie still.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useSessionHeaders, type InstanceApi } from '@ks/api-client'
import { STORY_TOC_QUESTION, type ChatProcessingStep, type DocReference, type StoryTopicsData } from '@ks/contracts'
import { fehlerText, streamAdresse, streamKoerper } from './anfrage'
import { sseSchritte } from './sse'
import type { AnfrageRahmen, Nachricht } from './types'
import { istBeleg } from './verlauf'

export interface UseStoryStreamParams {
  libraryId: string
  instanz: InstanceApi
  isSignedIn: boolean
  rahmen: AnfrageRahmen
  nachrichten: Nachricht[]
  setNachrichten: Dispatch<SetStateAction<Nachricht[]>>
  /** Der Server hat eine Sitzung angelegt (erste Frage ohne Kennung). */
  onSitzung: (chatId: string) => void
  /** Belege der frischen Antwort — die Galerie zeigt sie rechts. */
  onBelege?: (belege: DocReference[], queryId: string) => void
  /** Ergebnis der Themenuebersicht; `null`, wenn der Server keine Gliederung lieferte. */
  onUebersicht?: (gliederung: StoryTopicsData | null, queryId: string) => void
  onFehler: (text: string) => void
  /** Eingabegrenze der Library; ohne Angabe keine Pruefung. */
  maxZeichen?: number
  maxZeichenHinweis?: string
}

export interface UseStoryStreamResult {
  laeuft: boolean
  schritte: ChatProcessingStep[]
  frageSenden: (text: string) => Promise<void>
  /** Themenuebersicht holen; `neu` umgeht den Cache des Servers. */
  uebersichtLaden: (neu?: boolean) => Promise<void>
}

type Abschluss = Extract<ChatProcessingStep, { type: 'complete' }>

export function useStoryStream(p: UseStoryStreamParams): UseStoryStreamResult {
  const { libraryId, instanz, isSignedIn, rahmen, nachrichten, setNachrichten, onSitzung, onBelege, onUebersicht, onFehler } = p
  const sessionHeaders = useSessionHeaders(isSignedIn)
  const [laeuft, setLaeuft] = useState(false)
  const [schritte, setSchritte] = useState<ChatProcessingStep[]>([])

  const abschliessen = useCallback(
    (schritt: Abschluss, frageId: string | null) => {
      if (typeof schritt.chatId === 'string' && schritt.chatId !== '' && !rahmen.chatId) onSitzung(schritt.chatId)
      const queryId = typeof schritt.queryId === 'string' && schritt.queryId !== '' ? schritt.queryId : `temp-${Date.now()}`
      if (frageId === null) {
        onUebersicht?.(schritt.storyTopicsData ?? null, queryId)
        return
      }
      const belege = Array.isArray(schritt.references) ? schritt.references.filter(istBeleg) : []
      const anschlussfragen = Array.isArray(schritt.suggestedQuestions) ? schritt.suggestedQuestions.filter((q): q is string => typeof q === 'string') : []
      const kurztitel = typeof schritt.shortTitle === 'string' && schritt.shortTitle.trim() !== '' ? schritt.shortTitle : undefined
      const antwort: Nachricht = { id: `${queryId}-answer`, art: 'antwort', text: schritt.answer, createdAt: new Date().toISOString(), queryId, belege, anschlussfragen }
      setNachrichten((alt) => [
        ...alt.map((m) => (m.id === frageId ? { ...m, queryId, ...(kurztitel ? { kurztitel } : {}) } : m)),
        antwort,
      ])
      if (belege.length > 0) onBelege?.(belege, queryId)
    },
    [rahmen.chatId, onSitzung, onUebersicht, onBelege, setNachrichten],
  )

  const senden = useCallback(
    async (text: string, opts: { uebersicht: boolean; ohneCache?: boolean }) => {
      if (laeuft) return
      // Die Eingabegrenze gilt fuer Fragen der Person, nicht fuer die Systemfrage der Uebersicht.
      if (!opts.uebersicht && p.maxZeichen !== undefined && text.length > p.maxZeichen) {
        onFehler(p.maxZeichenHinweis ?? `Die Frage ist zu lang (höchstens ${p.maxZeichen} Zeichen).`)
        return
      }
      setLaeuft(true)
      setSchritte([])
      const frageId = opts.uebersicht ? null : `question-${Date.now()}`
      if (frageId) {
        setNachrichten((alt) => [...alt, { id: frageId, art: 'frage', text, createdAt: new Date().toISOString() }])
      }
      try {
        const res = await instanz.fetch(streamAdresse(libraryId, rahmen), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...sessionHeaders },
          // Die Themenuebersicht erkennt der Server am Fragetext (STORY_TOC_QUESTION), nicht an `asTOC`.
          body: JSON.stringify(streamKoerper(text, rahmen, nachrichten, { ohneCache: opts.ohneCache })),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('Stream nicht verfügbar')
        const decoder = new TextDecoder()
        let puffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const [neue, rest] = sseSchritte(decoder.decode(value, { stream: true }), puffer)
          puffer = rest
          for (const schritt of neue) {
            setSchritte((alt) => [...alt, schritt])
            if (schritt.type === 'error') throw new Error(schritt.error || 'Unbekannter Fehler')
            if (schritt.type === 'complete') {
              abschliessen(schritt, frageId)
              return
            }
          }
        }
        throw new Error('Der Stream endete ohne Antwort')
      } catch (e) {
        console.error('[useStoryStream] Fehler beim Senden', e)
        onFehler(fehlerText(e instanceof Error ? e.message : String(e)))
        if (frageId) setNachrichten((alt) => alt.filter((m) => m.id !== frageId))
      } finally {
        setSchritte([])
        setLaeuft(false)
      }
    },
    [laeuft, p.maxZeichen, p.maxZeichenHinweis, onFehler, setNachrichten, instanz, libraryId, rahmen, sessionHeaders, nachrichten, abschliessen],
  )

  const frageSenden = useCallback((text: string) => senden(text, { uebersicht: false }), [senden])
  const uebersichtLaden = useCallback((neu = false) => senden(STORY_TOC_QUESTION, { uebersicht: true, ohneCache: neu }), [senden])

  return { laeuft, schritte, frageSenden, uebersichtLaden }
}
