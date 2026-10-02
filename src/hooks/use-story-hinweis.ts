'use client'

/**
 * Einmaliger Hinweis zur Bedienung des Story-Modus (D10): Der Browser merkt
 * sich „gesehen" wie die Perspektive (localStorage), ein Atom teilt den
 * Zustand zwischen Kopf („?" holt den Hinweis zurueck) und Mitte (zeigt ihn,
 * „Verstanden" merkt und schliesst).
 *
 * `null` heisst: noch nicht aus dem Browser gelesen (SSR, erster Render) —
 * dann wird nichts gezeigt, kein stiller Standard.
 */

import { useCallback, useEffect } from 'react'
import { atom, useAtom } from 'jotai'

export const STORY_HINWEIS_GESEHEN_KEY = 'story-hinweis-gesehen'

const storyHinweisOffenAtom = atom<boolean | null>(null)

export interface StoryHinweisZustand {
  offen: boolean
  zeigen: () => void
  verstanden: () => void
}

export function useStoryHinweis(): StoryHinweisZustand {
  const [offen, setOffen] = useAtom(storyHinweisOffenAtom)

  useEffect(() => {
    if (offen !== null) return
    try {
      setOffen(localStorage.getItem(STORY_HINWEIS_GESEHEN_KEY) !== 'true')
    } catch (error) {
      console.warn('[useStoryHinweis] localStorage nicht lesbar, Hinweis bleibt zu:', error)
      setOffen(false)
    }
  }, [offen, setOffen])

  const zeigen = useCallback(() => setOffen(true), [setOffen])
  const verstanden = useCallback(() => {
    try {
      localStorage.setItem(STORY_HINWEIS_GESEHEN_KEY, 'true')
    } catch (error) {
      console.warn('[useStoryHinweis] localStorage nicht schreibbar, Hinweis kommt beim naechsten Besuch wieder:', error)
    }
    setOffen(false)
  }, [setOffen])

  return { offen: offen === true, zeigen, verstanden }
}
