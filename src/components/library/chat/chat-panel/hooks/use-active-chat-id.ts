/**
 * Hook fuer persistente activeChatId-Verwaltung via localStorage.
 *
 * Extrahiert aus chat-panel.tsx (Welle 3-III-b). Seit D1 (Story-Chronik)
 * liegt der Wert zusaetzlich in einem Jotai-Atom: Chat-Panel (Mitte) und
 * Chronik (links) haengen als getrennte Slots im Story-Reiter und muessen
 * dieselbe aktive Sitzung sehen — zwei lokale useState-Instanzen wuessten
 * nichts voneinander. localStorage bleibt die Persistenz ueber Seitenladen.
 *
 * Kein 'use client' noetig — wird nur in Client-Komponenten verwendet.
 */

import { useCallback, useEffect } from 'react'
import { atom, useAtom } from 'jotai'

/** Aktive Sitzung je Library; fehlt der Schluessel, wurde noch nicht aus localStorage gelesen. */
const activeChatIdsAtom = atom<Record<string, string | null>>({})

/** Liest activeChatId sicher aus localStorage */
function getStoredActiveChatId(libId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(`chat-activeChatId-${libId}`) || null
  } catch (error) {
    // localStorage nicht verfuegbar (z.B. Private-Mode-Restriktion) — null zurueckgeben
    console.warn('[useActiveChatId] getStoredActiveChatId: localStorage-Fehler:', error)
    return null
  }
}

/** Schreibt activeChatId sicher in localStorage */
function saveActiveChatId(libId: string, chatId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (chatId) {
      localStorage.setItem(`chat-activeChatId-${libId}`, chatId)
    } else {
      localStorage.removeItem(`chat-activeChatId-${libId}`)
    }
  } catch (error) {
    // localStorage nicht verfuegbar (z.B. Private-Mode-Restriktion) — Speicherung uebersprungen
    console.warn('[useActiveChatId] saveActiveChatId: localStorage-Fehler:', error)
  }
}

interface UseActiveChatIdResult {
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
}

/**
 * Verwaltet activeChatId mit localStorage-Persistenz, geteilt ueber ein Atom.
 *
 * @param libraryId - Library-ID fuer den localStorage-Schluessel
 * @returns activeChatId und Setter (persistiert automatisch in localStorage)
 */
export function useActiveChatId(libraryId: string): UseActiveChatIdResult {
  const [ids, setIds] = useAtom(activeChatIdsAtom)
  const gelesen = libraryId !== '' && libraryId in ids
  const activeChatId = gelesen ? ids[libraryId] : null

  // Einmal je Library aus localStorage lesen (im Effekt, nicht im Render:
  // der Server kennt kein localStorage, die Hydration bliebe sonst uneins).
  useEffect(() => {
    if (!libraryId || gelesen) return
    const stored = getStoredActiveChatId(libraryId)
    setIds((prev) => (libraryId in prev ? prev : { ...prev, [libraryId]: stored }))
  }, [libraryId, gelesen, setIds])

  const setActiveChatId = useCallback(
    (chatId: string | null) => {
      if (!libraryId) return
      setIds((prev) => ({ ...prev, [libraryId]: chatId }))
      saveActiveChatId(libraryId, chatId)
    },
    [libraryId, setIds],
  )

  return { activeChatId, setActiveChatId }
}
