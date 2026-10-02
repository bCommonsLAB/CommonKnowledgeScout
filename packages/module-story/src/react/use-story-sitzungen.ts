/**
 * Sitzungen (= Chats) der Person in dieser Library, fuer die Chronik.
 *
 * Liest ueber die Instanz (`instanz.fetch`), nie ueber nacktes `fetch`:
 * `GET /api/chat/{id}/chats` fuer die Liste, `GET …/queries?chatId=` fuer die
 * Fragen einer Sitzung (erst beim Aufklappen — eine Anfrage je Sitzung statt
 * N beim Start), `PATCH …/chats/{chatId}` zum Umbenennen. Anonyme Betrachter
 * schicken ihre Sitzungskennung als `X-Session-ID` (Owner 01.10.: 30 Tage,
 * Browser-gebunden).
 *
 * Fehler werden gehalten und angezeigt, nicht verschluckt (no-silent-fallbacks).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSessionHeaders, type InstanceApi } from '@ks/api-client'
import type { ChronikFrage, ChronikSitzung } from './types'

interface ChatEintrag {
  chatId: string
  title: string
  createdAt: string
}

interface FrageEintrag {
  queryId: string
  question: string
  /** D5: Kurztitel vom Sprachmodell; alte Eintraege haben keinen. */
  shortTitle?: string
  createdAt: string
  status?: 'pending' | 'ok' | 'error'
  /** `'toc'` ist die Themenuebersicht, keine Frage der Person (D1, Server-Projektion). */
  queryType?: 'toc' | 'question'
}

export interface UseStorySitzungenParams {
  libraryId: string
  instanz: InstanceApi
  isSignedIn: boolean
  /** Die aktive Sitzung der App; taucht sie noch nicht in der Liste auf, wird neu geladen. */
  aktiveChatId: string | null
}

export interface UseStorySitzungenResult {
  /** Neueste zuerst. */
  sitzungen: ChronikSitzung[]
  ladend: boolean
  fehler: string | null
  /** Fragen einer Sitzung nachladen (idempotent, laedt nur einmal). */
  fragenLaden: (chatId: string) => Promise<void>
  umbenennen: (chatId: string, titel: string) => Promise<void>
  neuLaden: () => Promise<void>
}

function meldung(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function antwortPruefen(res: Response, was: string): Promise<void> {
  if (!res.ok) throw new Error(`${was}: HTTP ${res.status}`)
}

export function useStorySitzungen({ libraryId, instanz, isSignedIn, aktiveChatId }: UseStorySitzungenParams): UseStorySitzungenResult {
  const sessionHeaders = useSessionHeaders(isSignedIn)
  const [sitzungen, setSitzungen] = useState<ChronikSitzung[]>([])
  const [ladend, setLadend] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const geladeneFragen = useRef(new Set<string>())
  const basis = useMemo(() => `/api/chat/${encodeURIComponent(libraryId)}`, [libraryId])

  const neuLaden = useCallback(async () => {
    // D9: Die Schale montiert die Chronik, bevor die Library bekannt ist (Kennung leer).
    // Ohne Kennung gibt es nichts zu laden — kein Aufruf ins Leere (`/api/chat//chats` → 405).
    if (libraryId === '') return
    setLadend(true)
    try {
      const res = await instanz.fetch(`${basis}/chats?limit=50`, { headers: sessionHeaders, cache: 'no-store' })
      await antwortPruefen(res, 'Sitzungen laden')
      const body = (await res.json()) as { items?: ChatEintrag[] }
      const items = Array.isArray(body.items) ? body.items : []
      setSitzungen((vorher) =>
        items.map((chat) => {
          const bekannt = vorher.find((s) => s.chatId === chat.chatId)
          return { chatId: chat.chatId, titel: chat.title, createdAt: String(chat.createdAt), fragen: bekannt?.fragen }
        }),
      )
      setFehler(null)
    } catch (e) {
      setFehler(meldung(e))
    } finally {
      setLadend(false)
    }
  }, [basis, instanz, libraryId, sessionHeaders])

  useEffect(() => {
    void neuLaden()
  }, [neuLaden])

  // Die App hat eine neue Sitzung eroeffnet (erste Frage): Liste nachziehen.
  useEffect(() => {
    if (aktiveChatId && !ladend && !sitzungen.some((s) => s.chatId === aktiveChatId)) void neuLaden()
    // `sitzungen`/`ladend` bewusst nicht als Abhaengigkeit: nur der Wechsel der Kennung soll laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiveChatId, neuLaden])

  const fragenLaden = useCallback(
    async (chatId: string) => {
      if (libraryId === '' || geladeneFragen.current.has(chatId)) return
      geladeneFragen.current.add(chatId)
      try {
        const res = await instanz.fetch(`${basis}/queries?limit=100&chatId=${encodeURIComponent(chatId)}`, {
          headers: sessionHeaders,
          cache: 'no-store',
        })
        await antwortPruefen(res, 'Fragen laden')
        const body = (await res.json()) as { items?: FrageEintrag[] }
        const fragen: ChronikFrage[] = (Array.isArray(body.items) ? body.items : [])
          .filter((q) => q.queryType !== 'toc')
          .map((q) => ({
            queryId: q.queryId,
            text: q.question,
            kurztitel: typeof q.shortTitle === 'string' && q.shortTitle.trim() !== '' ? q.shortTitle : undefined,
            createdAt: String(q.createdAt),
            offen: q.status === 'pending',
          }))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        setSitzungen((vorher) => vorher.map((s) => (s.chatId === chatId ? { ...s, fragen } : s)))
        setFehler(null)
      } catch (e) {
        geladeneFragen.current.delete(chatId)
        setFehler(meldung(e))
      }
    },
    [basis, instanz, libraryId, sessionHeaders],
  )

  const umbenennen = useCallback(
    async (chatId: string, titel: string) => {
      const neu = titel.trim()
      if (neu === '') throw new Error('Titel darf nicht leer sein')
      const res = await instanz.fetch(`${basis}/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...sessionHeaders },
        body: JSON.stringify({ title: neu }),
      })
      await antwortPruefen(res, 'Sitzung umbenennen')
      setSitzungen((vorher) => vorher.map((s) => (s.chatId === chatId ? { ...s, titel: neu } : s)))
    },
    [basis, instanz, sessionHeaders],
  )

  return { sitzungen, ladend, fehler, fragenLaden, umbenennen, neuLaden }
}
