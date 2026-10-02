/**
 * Verlauf der aktiven Sitzung (D6b; wie `use-chat-history` der App, aber
 * ueber die Instanz und ohne Clerk): eine Anfrage je Sitzung
 * (`GET …/queries?limit=100&chatId=`), Nachrichten aus der Liste.
 *
 * Lokal hinzugekommene Nachrichten (laufende Frage ohne queryId) bleiben beim
 * Laden erhalten; der Verlauf wird darunter einsortiert. „Neue Sitzung"
 * (Kennung von gesetzt auf `null`) leert den Verlauf — der der alten Sitzung
 * gehoert nicht in die neue. Dasselbe beim Wechsel von einer Sitzung in eine
 * andere (Chronik, `?q=`, Zurueck-Knopf; D12c): Gespeicherte Nachrichten der
 * alten Sitzung fallen weg, sonst stuenden ihre Fragen unter der neuen
 * Sitzung und gingen als Verlauf an das Sprachmodell. Fehler werden
 * gemeldet, nicht verschluckt.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useSessionHeaders, type InstanceApi } from '@ks/api-client'
import type { Nachricht } from './types'
import { VERLAUF_LIMIT, verlaufZuNachrichten, type VerlaufEintrag } from './verlauf'

export interface UseStoryVerlaufParams {
  libraryId: string
  instanz: InstanceApi
  isSignedIn: boolean
  chatId: string | null
}

export interface UseStoryVerlaufResult {
  nachrichten: Nachricht[]
  setNachrichten: Dispatch<SetStateAction<Nachricht[]>>
  ladend: boolean
  fehler: string | null
}

/** Verlauf unter die lokalen Nachrichten mischen: Lokales ohne gespeicherte Kennung bleibt. */
export function verlaufMischen(lokal: Nachricht[], verlauf: Nachricht[]): Nachricht[] {
  if (verlauf.length === 0) return lokal
  const bekannt = new Set(verlauf.map((m) => m.queryId).filter((id): id is string => !!id))
  const neu = lokal.filter((m) => !m.queryId || !bekannt.has(m.queryId))
  return [...neu, ...verlauf].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function useStoryVerlauf({ libraryId, instanz, isSignedIn, chatId }: UseStoryVerlaufParams): UseStoryVerlaufResult {
  const sessionHeaders = useSessionHeaders(isSignedIn)
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
  const [ladend, setLadend] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const vorherigeChatId = useRef<string | null>(chatId)

  useEffect(() => {
    const vorher = vorherigeChatId.current
    vorherigeChatId.current = chatId
    if (chatId === null) {
      if (vorher !== null) setNachrichten([])
      return
    }
    // D12c: Wechsel in eine andere Sitzung — nur Lokales ohne gespeicherte Kennung
    // bleibt (eine gerade laufende Frage). Von `null` auf die erste Kennung (die
    // erste Frage hat die Sitzung eroeffnet) bleibt alles stehen.
    if (vorher !== null && vorher !== chatId) setNachrichten((lokal) => lokal.filter((m) => !m.queryId))
    let aktuell = true
    const laden = async () => {
      setLadend(true)
      try {
        const res = await instanz.fetch(
          `/api/chat/${encodeURIComponent(libraryId)}/queries?limit=${VERLAUF_LIMIT}&chatId=${encodeURIComponent(chatId)}`,
          { cache: 'no-store', headers: sessionHeaders },
        )
        if (!aktuell) return
        // 404: keine Historie — ein normaler Zustand, kein Fehler.
        if (res.status === 404) return
        if (!res.ok) throw new Error(`Verlauf laden: HTTP ${res.status}`)
        const body = (await res.json()) as { items?: VerlaufEintrag[] }
        if (!aktuell) return
        const verlauf = verlaufZuNachrichten(Array.isArray(body.items) ? body.items : [])
        setNachrichten((lokal) => verlaufMischen(lokal, verlauf))
        setFehler(null)
      } catch (e) {
        if (aktuell) setFehler(e instanceof Error ? e.message : String(e))
      } finally {
        if (aktuell) setLadend(false)
      }
    }
    void laden()
    return () => {
      aktuell = false
    }
  }, [libraryId, instanz, sessionHeaders, chatId])

  return { nachrichten, setNachrichten, ladend, fehler }
}
