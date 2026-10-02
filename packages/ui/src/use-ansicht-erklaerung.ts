'use client'

/**
 * Erklaerung einer Ansicht (D10b): beim ersten Besuch aufgeklappt, der
 * Browser merkt sich „eingeklappt" je Ansicht (localStorage, wie die
 * Perspektive). Bis der Browser gelesen ist, gilt „zu" — kein Aufblitzen.
 */

import { useCallback, useEffect, useState } from 'react'

export const ANSICHT_ERKLAERUNG_KEY_PREFIX = 'ansicht-erklaerung-zu:'

export interface AnsichtErklaerungZustand {
  offen: boolean
  toggle: () => void
}

export function useAnsichtErklaerung(schluessel: string): AnsichtErklaerungZustand {
  const [offen, setOffen] = useState<boolean | null>(null)
  const key = ANSICHT_ERKLAERUNG_KEY_PREFIX + schluessel

  useEffect(() => {
    try {
      setOffen(localStorage.getItem(key) !== 'true')
    } catch (error) {
      console.warn('[useAnsichtErklaerung] localStorage nicht lesbar, Erklaerung bleibt zu:', error)
      setOffen(false)
    }
  }, [key])

  const toggle = useCallback(() => {
    setOffen((vorher) => {
      const neu = !(vorher === true)
      try {
        if (neu) localStorage.removeItem(key)
        else localStorage.setItem(key, 'true')
      } catch (error) {
        console.warn('[useAnsichtErklaerung] localStorage nicht schreibbar, Zustand gilt nur fuer diese Seite:', error)
      }
      return neu
    })
  }, [key])

  return { offen: offen === true, toggle }
}
