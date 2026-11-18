'use client'

/**
 * Weg aus der Story-Sektion in die Galerie (Welle N1, herausgelöst 09.11.2026
 * für die Karten-Darstellungen): im Site-Modus `onShowGallery({ doc })`, im
 * Root-Modus (`/` einer gekoppelten Domain) die Galerie-Adresse mit `?doc=`.
 * Dazu die `GalleryNavigation`, die `DocumentCard` und `ReferencesSheet`
 * aus `@ks/module-explorer` als Kontext verlangen; alles, was die Sektion
 * nicht braucht, wirft statt still nichts zu tun.
 */

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { GalleryNavigation } from '@ks/module-explorer/react'

export interface WebsiteStoryNavigation {
  /** Site-Modus: wechselt in die lokale Galerie; `extra` = Adress-Parameter (wie das Banner, F3). */
  onShowGallery?: (extra?: Record<string, string>) => void
  /** Root-Modus: Galerie-Adresse, traegt schon `?view=gallery`; null im Site-Modus. */
  galleryBaseHref: string | null
  /** Site-Modus: wechselt in den Story-Modus; `extra` = Adress-Parameter (Verweis „fruehere Fragen" gibt `q` mit, 08.11.2026). */
  onShowStory?: (extra?: Record<string, string>) => void
  /** Root-Modus: Adresse des Story-Modus, traegt schon `?mode=story`; null im Site-Modus. */
  storyBaseHref: string | null
}

function nichtVorgesehen(name: string): never {
  throw new Error(`Story-Sektion: ${name} ist hier nicht vorgesehen`)
}

/**
 * `oeffneLokal`: die Detailansicht ueber der Startseite (Owner 10.11.2026 — der
 * Klick auf einen Beleg soll die Seite nicht verlassen). Liefert true, wenn das
 * Dokument zum Slug bekannt war und geoeffnet wurde; sonst geht es wie bisher in
 * die Galerie, und das steht im Protokoll.
 */
export type OeffneLokal = (slug: string, page?: number) => boolean

export function useWebsiteStoryNavigation(navigation: WebsiteStoryNavigation, onClose: () => void, oeffneLokal?: OeffneLokal) {
  const router = useRouter()
  const { onShowGallery, galleryBaseHref } = navigation

  const zurGalerie = useCallback(
    (extra: Record<string, string>) => {
      if (onShowGallery) onShowGallery(extra)
      else if (galleryBaseHref) {
        const q = new URLSearchParams(extra).toString()
        router.push(q ? `${galleryBaseHref}&${q}` : galleryBaseHref)
      } else console.error('[Story-Sektion] Weder onShowGallery noch galleryBaseHref — die Galerie ist von hier nicht erreichbar')
    },
    [onShowGallery, galleryBaseHref, router],
  )

  const nav = useMemo<GalleryNavigation>(
    () => ({
      openDocument: (slug, opts) => {
        if (oeffneLokal?.(slug, opts?.page)) return
        if (oeffneLokal) console.warn(`[Story-Sektion] Dokument "${slug}" ist hier nicht geladen — oeffne es in der Galerie`)
        zurGalerie({ doc: slug })
      },
      closeDocument: onClose,
      // Leer = kein Teilen-Knopf (Vertrag des Kontexts).
      documentShareUrl: () => '',
      params: new URLSearchParams(),
      replaceParams: () => nichtVorgesehen('replaceParams'),
      pushParams: () => nichtVorgesehen('pushParams'),
      applyModeParams: () => nichtVorgesehen('applyModeParams'),
    }),
    [zurGalerie, onClose, oeffneLokal],
  )

  return { zurGalerie, nav }
}
