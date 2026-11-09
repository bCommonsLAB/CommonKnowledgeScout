'use client'

/**
 * Belege der Story-Sektion als Blatt von rechts (Welle N1): dieselbe
 * `BelegListe` im `ReferencesSheet` wie der Story-Modus auf dem Telefon.
 *
 * Ein Beleg oeffnet sein Dokument in der Galerie — mit demselben Weg wie
 * die Banner-Karten und die Kartenspalte (`use-website-story-navigation.ts`).
 * Der Titel traegt die Bezeichnung der Library (z. B. „Talks"), ohne sie
 * den Paket-Text „Belege" (Owner 09.11.2026).
 */

import type { CSSProperties } from 'react'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { GalleryNavigationProvider, ReferencesSheet } from '@ks/module-explorer/react'
import { useWebsiteStoryNavigation, type WebsiteStoryNavigation } from './use-website-story-navigation'

export type { WebsiteStoryNavigation } from './use-website-story-navigation'

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
  /** Titel des Blatts mit der Bezeichnung der Library; undefined = „Belege". */
  titel?: string
}

export function WebsiteStoryBelege(p: WebsiteStoryBelegeProps) {
  const { zurGalerie, nav } = useWebsiteStoryNavigation(p.navigation, () => p.onOpenChange(false))

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
        titel={p.titel}
        style={p.markenFarbe ? ({ ['--zitat-mark' as string]: p.markenFarbe } as CSSProperties) : undefined}
      />
    </GalleryNavigationProvider>
  )
}
