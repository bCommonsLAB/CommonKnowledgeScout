'use client'

/**
 * Belege der Story-Sektion als Blatt von rechts (Welle N1): dieselbe
 * `BelegListe` im `ReferencesSheet` wie der Story-Modus auf dem Telefon.
 *
 * Ein Beleg oeffnet sein Dokument in der Galerie — mit demselben Weg wie
 * die Banner-Karten: im Site-Modus `onShowGallery({ doc })`, im Root-Modus
 * (`/` einer gekoppelten Domain) die Galerie-Adresse mit `?doc=`. Dafuer
 * bekommt das Blatt eine eigene `GalleryNavigation`; alles, was die
 * Belegliste nicht braucht, wirft statt still nichts zu tun.
 */

import { useCallback, useMemo, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { GalleryNavigationProvider, ReferencesSheet, type GalleryNavigation } from '@ks/module-explorer/react'

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

export interface WebsiteStoryBelegeProps {
  libraryId: string
  offen: boolean
  onOpenChange: (offen: boolean) => void
  references: DocReference[]
  /** Die zitierten Dokumente (`useBelegDokumente`); leer = Titel nur aus der Referenz. */
  usedDocs: DocCardMeta[]
  katalogAnzahl: number
  navigation: WebsiteStoryNavigation
  /** Markenfarbe der Website (`accentInk`) fuer die Belegnummern — das Blatt haengt am `body`, die Site-Variablen erben nicht hinein. */
  markenFarbe?: string
}

function nichtVorgesehen(name: string): never {
  throw new Error(`WebsiteStoryBelege: ${name} ist in der Story-Sektion nicht vorgesehen`)
}

export function WebsiteStoryBelege(p: WebsiteStoryBelegeProps) {
  const router = useRouter()
  const { onShowGallery, galleryBaseHref } = p.navigation

  const zurGalerie = useCallback(
    (extra: Record<string, string>) => {
      if (onShowGallery) onShowGallery(extra)
      else if (galleryBaseHref) {
        const q = new URLSearchParams(extra).toString()
        router.push(q ? `${galleryBaseHref}&${q}` : galleryBaseHref)
      } else console.error('[WebsiteStoryBelege] Weder onShowGallery noch galleryBaseHref — die Galerie ist von hier nicht erreichbar')
    },
    [onShowGallery, galleryBaseHref, router],
  )

  const nav = useMemo<GalleryNavigation>(
    () => ({
      openDocument: (slug) => zurGalerie({ doc: slug }),
      closeDocument: () => p.onOpenChange(false),
      // Leer = kein Teilen-Knopf (Vertrag des Kontexts).
      documentShareUrl: () => '',
      params: new URLSearchParams(),
      replaceParams: () => nichtVorgesehen('replaceParams'),
      pushParams: () => nichtVorgesehen('pushParams'),
      applyModeParams: () => nichtVorgesehen('applyModeParams'),
    }),
    [zurGalerie, p],
  )

  return (
    <GalleryNavigationProvider navigation={nav}>
      <ReferencesSheet
        open={p.offen}
        onOpenChange={p.onOpenChange}
        libraryId={p.libraryId}
        mode="answer"
        references={p.references}
        usedDocs={p.usedDocs}
        unusedDocs={[]}
        anzahl={p.katalogAnzahl}
        onKatalog={() => zurGalerie({})}
        style={p.markenFarbe ? ({ ['--zitat-mark' as string]: p.markenFarbe } as CSSProperties) : undefined}
      />
    </GalleryNavigationProvider>
  )
}
