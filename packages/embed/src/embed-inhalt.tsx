'use client'

/**
 * Der Inhalt im Rahmen von `KnowledgeScoutExplorer`: eigener Speicher,
 * Sprache, Portale, Tooltips, die drei Embed-Antworten der Galerie.
 *
 * Eigene Komponente, damit sie mit einem neuen Einstieg neu beginnt (Plan
 * `startseite-als-embed`, WE0): Die Huelle setzt den Einstieg als `key`. Der
 * Anfangszustand der Adressierung und die Auswahl der Frage gelten beim
 * Montieren — wechselt die Container-Seite ihre Adresse, montiert der Inhalt
 * neu, statt mit dem alten Zustand weiterzulaufen.
 */

import { useState } from 'react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import type { InstanceApi } from '@ks/api-client'
import type { Locale } from '@ks/i18n'
import { PortalContainerProvider, TooltipProvider } from '@ks/ui'
import { EmbedGalleryProviders } from '@ks/module-explorer/react'
import { storyAuswahlAtom } from '@ks/module-story/react'
import { EmbedGalerie } from './embed-galerie'
import { EmbedLocale } from './embed-locale'

export interface EmbedInhaltProps {
  rahmen: HTMLDivElement
  library: string
  instanz: InstanceApi
  locale: Locale
  story: boolean
  perspektive: boolean
  /** Anfangszustand der Adressierung, z. B. `mode=story` oder `doc=…&page=…`. */
  initialParams: string | undefined
  /** Gespeicherte Frage (queryId), die der Story-Modus beim Start zeigt. */
  frage: string | undefined
}

/** Ein eigener Jotai-Speicher je Embed; mit Frage startet die Story-Auswahl auf ihr. */
function speicherFuer(frage: string | undefined) {
  const speicher = createStore()
  if (frage) speicher.set(storyAuswahlAtom, { art: 'konversation', queryId: frage })
  return speicher
}

export function EmbedInhalt({ rahmen, library, instanz, locale, story, perspektive, initialParams, frage }: EmbedInhaltProps) {
  // Einmal je Montage: Die Galerie-Atome kollidieren weder mit der Seite noch mit einem zweiten Embed.
  const [speicher] = useState(() => speicherFuer(frage))
  return (
    <JotaiProvider store={speicher}>
      <EmbedLocale locale={locale} />
      <PortalContainerProvider container={rahmen}>
        <TooltipProvider>
          <EmbedGalleryProviders instanz={instanz} initialParams={initialParams}>
            <EmbedGalerie slug={library} instanz={instanz} story={story} perspektive={perspektive} locale={locale} frage={frage} />
          </EmbedGalleryProviders>
        </TooltipProvider>
      </PortalContainerProvider>
    </JotaiProvider>
  )
}
