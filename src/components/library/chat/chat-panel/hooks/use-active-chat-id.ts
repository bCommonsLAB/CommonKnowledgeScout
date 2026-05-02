/**
 * Hook fuer persistente activeChatId-Verwaltung via localStorage.
 *
 * Extrahiert aus chat-panel.tsx (Welle 3-III-b).
 * Kapselt: localStorage-Lesen beim Mount, persistentes Schreiben beim
 * Aendern, Sync bei libraryId-Wechsel.
 *
 * Kein 'use client' noetig — wird nur in Client-Komponenten verwendet.
 */

import { useState, useCallback, useEffect } from 'react'

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
 * Verwaltet activeChatId mit localStorage-Persistenz.
 *
 * @param libraryId - Library-ID fuer den localStorage-Schluessel
 * @returns activeChatId und Setter (persistiert automatisch in localStorage)
 */
export function useActiveChatId(libraryId: string): UseActiveChatIdResult {
  const [activeChatId, setActiveChatIdState] = useState<string | null>(() =>
    libraryId ? getStoredActiveChatId(libraryId) : null
  )

  // Sync activeChatId aus localStorage bei libraryId-Wechsel
  useEffect(() => {
    if (libraryId) {
      const stored = getStoredActiveChatId(libraryId)
      if (stored !== activeChatId) {
        // setActiveChatIdState direkt verwenden, nicht setActiveChatId,
        // um eine Endlosschleife (Lesen→Schreiben→Lesen) zu vermeiden
        setActiveChatIdState(stored)
      }
    }
    // activeChatId bewusst nicht als Dependency — verhindert Endlosschleife
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId])

  const setActiveChatId = useCallback((chatId: string | null) => {
    setActiveChatIdState(chatId)
    if (libraryId) {
      saveActiveChatId(libraryId, chatId)
    }
  }, [libraryId])

  return { activeChatId, setActiveChatId }
}
