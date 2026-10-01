/**
 * Die aktive Sitzung je Library (D6b; wie `useActiveChatId` der App): im
 * Jotai-Atom geteilt zwischen Mitte und Chronik, im localStorage ueber das
 * Neuladen hinweg — unter demselben Schluessel wie die App, damit App und
 * Embed auf derselben Instanz dieselbe Sitzung sehen.
 */

import { useCallback, useEffect } from 'react'
import { atom, useAtom } from 'jotai'

const sitzungenAtom = atom<Record<string, string | null>>({})

function schluessel(libraryId: string): string {
  return `chat-activeChatId-${libraryId}`
}

function gespeichert(libraryId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(schluessel(libraryId)) || null
  } catch (e) {
    console.warn('[useStorySitzungId] localStorage nicht lesbar', e)
    return null
  }
}

function speichern(libraryId: string, chatId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (chatId) localStorage.setItem(schluessel(libraryId), chatId)
    else localStorage.removeItem(schluessel(libraryId))
  } catch (e) {
    console.warn('[useStorySitzungId] localStorage nicht schreibbar', e)
  }
}

export interface UseStorySitzungIdResult {
  chatId: string | null
  setChatId: (chatId: string | null) => void
}

export function useStorySitzungId(libraryId: string): UseStorySitzungIdResult {
  const [ids, setIds] = useAtom(sitzungenAtom)
  const gelesen = libraryId !== '' && libraryId in ids
  const chatId = gelesen ? ids[libraryId] : null

  // Einmal je Library lesen — im Effekt, nicht im Render (Hydration).
  useEffect(() => {
    if (!libraryId || gelesen) return
    const wert = gespeichert(libraryId)
    setIds((alt) => (libraryId in alt ? alt : { ...alt, [libraryId]: wert }))
  }, [libraryId, gelesen, setIds])

  const setChatId = useCallback(
    (neu: string | null) => {
      if (!libraryId) return
      setIds((alt) => ({ ...alt, [libraryId]: neu }))
      speichern(libraryId, neu)
    },
    [libraryId, setIds],
  )

  return { chatId, setChatId }
}
