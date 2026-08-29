'use client'

/**
 * use-debounced-value — liefert einen Wert erst, nachdem er `delayMs`
 * lang stabil war.
 *
 * Einsatz: Galerie-Suche. Ohne Debounce loest JEDER Tastendruck einen
 * kompletten Server-Refetch aus und die Liste wird geleert und neu
 * aufgebaut (Befund 2026-07-08). Das Eingabefeld selbst bleibt an den
 * sofortigen Wert gebunden; nur die Daten-Hooks bekommen den
 * debounced Wert.
 */

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])

  return debounced
}
