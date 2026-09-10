'use client'

/**
 * @fileoverview Die Adressierung ohne Adresszeile: Die Galerie fuehrt ihren Zustand selbst.
 *
 * @description
 * Gegenstueck zu `NextGalleryNavigation` in der App. Dort steht die Galerie in
 * der URL (`?doc=`, `?mode=`, `?view=` …). Im Embed geht das nicht: Die
 * Galerie laeuft als Gast in einer fremden Seite und fasst deren Adresse nicht
 * an (Owner-Entscheidung 2026-08-29). Hier liegen dieselben Parameter deshalb
 * im React-Zustand — gleiche Namen, gleiche Regeln, nur ohne Adresszeile.
 *
 * Zwei Unterschiede zur App, bewusst:
 * - Kein Verlauf: `pushParams` und `replaceParams` tun dasselbe. Der
 *   Zurueck-Knopf des Browsers gehoert der fremden Seite.
 * - Keine teilbare Adresse: `documentShareUrl` liefert `''`, der Teilen-Knopf
 *   blendet sich aus. Ein Link auf die fremde Seite oeffnete das Dokument nicht.
 *
 * `openDocument` und `closeDocument` folgen `src/utils/document-navigation.ts`:
 * `doc` setzen bzw. entfernen, alle anderen Parameter bleiben stehen.
 *
 * @module contexts
 */

import { useMemo, useState, type ReactNode } from 'react'
import { GalleryNavigationProvider, type GalleryNavigation } from './gallery-navigation-context'

export interface SpeicherGalleryNavigationProps {
  /**
   * Anfangszustand, z. B. `view=gallery`: So beginnt eine Library, deren
   * Standard die Website-Startseite ist, trotzdem in der Galerie.
   */
  initialParams?: string
  children: ReactNode
}

/** Eine Kopie mit einer Aenderung — der alte Zustand bleibt, wie er war. */
function mit(prev: URLSearchParams, aendern: (next: URLSearchParams) => void): URLSearchParams {
  const next = new URLSearchParams(prev.toString())
  aendern(next)
  return next
}

export function SpeicherGalleryNavigation({ initialParams, children }: SpeicherGalleryNavigationProps) {
  const [params, setParams] = useState(() => new URLSearchParams(initialParams ?? ''))

  const navigation = useMemo<GalleryNavigation>(() => {
    // Immer kopieren: Wer ein Objekt hereinreicht, darf es danach weiter
    // veraendern, ohne dass sich die Galerie mit veraendert.
    const setzen = (next: URLSearchParams) => setParams(new URLSearchParams(next.toString()))
    return {
      params,
      openDocument: (slug: string) => {
        if (!slug) {
          // Wie in der App gemeldet, nicht verschluckt (document-navigation.ts).
          console.warn('[SpeicherGalleryNavigation] Kein Slug angegeben')
          return
        }
        setParams((prev) => mit(prev, (next) => next.set('doc', slug)))
      },
      closeDocument: () => {
        setParams((prev) => mit(prev, (next) => next.delete('doc')))
      },
      documentShareUrl: () => '',
      replaceParams: setzen,
      pushParams: setzen,
      applyModeParams: setzen,
    }
  }, [params])

  return <GalleryNavigationProvider navigation={navigation}>{children}</GalleryNavigationProvider>
}
