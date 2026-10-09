'use client'

/**
 * Der Story-Modus im Embed (D6b): die drei Story-Slots der Galerie mit den
 * Bausteinen aus `@ks/module-story` — anonym ueber die Sitzungskennung
 * (ADR 0008: nur Oeffentliches, keine Anmeldung).
 *
 * Was die App ueber Clerk, Perspektiv-Dialog und Konfig-Store liefert, kommt
 * hier aus der oeffentlichen Library und der Instanz: Perspektive aus der
 * Chat-Konfig oder der eigenen Wahl (`embed-perspektive.tsx`, Sprache = Sprache
 * des Embeds), Modell = erstes der oeffentlich gelisteten (dieselbe Regel wie
 * `useStoryContext` der App), Belege ueber das Atom der Galerie,
 * Dokumentenzahl aus dem geteilten Galerie-Zustand. Modell und Perspektive
 * bestimmt `EmbedGalerie` einmal fuer Kopf und Mitte.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { fetchLlmModels, type InstanceApi } from '@ks/api-client'
import { useTranslation } from '@ks/i18n/react'
import {
  AIGeneratedNotice,
  chatReferencesAtom,
  galleryFiltersAtom,
  useGalleryData,
  type ExplorerLibraryPayload,
  type HinweisLinkProps,
} from '@ks/module-explorer/react'
import { StoryChronik, StoryKopfzeile, StoryRoot, useStorySitzungId, type Perspektive } from '@ks/module-story/react'

const ANONYM = { isSignedIn: false } as const

/** Die rechtlichen Hinweise der Instanz — wie in der Buch-Ansicht des Embeds, in einem neuen Tab. */
const HINWEIS_PFAD = '/info?type=rechtliche-hinweise'
function InstanzLink({ href, className, children }: HinweisLinkProps) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

/**
 * Das Modell fuer Fragen: das erste der oeffentlich gelisteten; `null` solange
 * unbekannt, `''` wenn keines da ist. Ohne Story (`aktiv` false) kein Abruf.
 */
export function useOeffentlichesModell(instanz: InstanceApi, aktiv: boolean): string | null {
  const [modell, setModell] = useState<string | null>(null)
  useEffect(() => {
    if (!aktiv) return
    let aktuell = true
    fetchLlmModels('public', { baseUrl: instanz.baseUrl })
      .then((modelle) => {
        if (!aktuell) return
        const erstes = modelle.find((m) => typeof m.modelId === 'string' && m.modelId !== '')
        if (!erstes) console.error('[KnowledgeScoutExplorer] Die Instanz listet kein Sprachmodell — Fragen sind nicht moeglich.')
        setModell(erstes?.modelId ?? '')
      })
      .catch((e: unknown) => {
        if (!aktuell) return
        console.error('[KnowledgeScoutExplorer] Sprachmodelle nicht ladbar', e)
        setModell('')
      })
    return () => {
      aktuell = false
    }
  }, [instanz, aktiv])
  return modell
}

export interface EmbedStoryProps {
  library: ExplorerLibraryPayload
  instanz: InstanceApi
  /** `null` solange das Modell noch geladen wird; `llmModel: ''` heisst: keines da. */
  perspektive: Perspektive | null
}

/** Slot `storyPanel`: die Mitte. */
export function EmbedStoryPanel({ library, instanz, perspektive, filterAnzeige }: EmbedStoryProps & { filterAnzeige?: ReactNode }) {
  const { t } = useTranslation()
  const filter = useAtomValue(galleryFiltersAtom)
  const setBelege = useSetAtom(chatReferencesAtom)
  // Zahl der (gefilterten) Dokumente aus dem Zustand, den die Galerie schon geladen hat.
  const galerie = useGalleryData(filter || {}, 'story', '', library.id, { skipApiCall: true })
  const chat = library.chat
  if (perspektive === null) return <p role="status" className="p-4 text-sm text-muted-foreground">{t('gallery.loading')}</p>
  if (perspektive.llmModel === '') return <p role="alert" className="p-4 text-sm text-destructive">{t('story.modelMissing')}</p>

  return (
    <StoryRoot
      libraryId={library.id}
      instanz={instanz}
      viewer={ANONYM}
      perspektive={perspektive}
      dokumente={galerie.loading ? null : galerie.totalCount || 0}
      filter={filter}
      filterAnzeige={filterAnzeige}
      eingabe={{ placeholder: chat?.placeholder, maxZeichen: chat?.maxChars, maxZeichenHinweis: chat?.maxCharsWarningMessage }}
      onBelege={(references, queryId) => setBelege({ references, queryId: queryId ?? undefined })}
      antwortFuss={() => <AIGeneratedNotice compact className="mt-3" hinweisHref={instanz.url(HINWEIS_PFAD)} Link={InstanzLink} />}
    />
  )
}

/** Slot `storyChronik`: Gliederung und „Meine Fragen" an der anonymen Sitzung. */
export function EmbedStoryChronik({ libraryId, instanz, onGewaehlt }: { libraryId: string; instanz: InstanceApi; onGewaehlt?: () => void }) {
  const { setChatId } = useStorySitzungId(libraryId)
  return (
    <StoryChronik
      libraryId={libraryId}
      instanz={instanz}
      viewer={ANONYM}
      onSitzungWaehlen={setChatId}
      onNeueSitzung={() => setChatId(null)}
      onGewaehlt={onGewaehlt}
    />
  )
}

export { StoryKopfzeile as EmbedStoryKopfzeile }
