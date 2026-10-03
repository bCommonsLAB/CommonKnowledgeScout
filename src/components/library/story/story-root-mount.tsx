'use client'

/**
 * Montagepunkt der Story-Mitte in der Voll-App (D6c): `StoryRoot` aus
 * `@ks/module-story` mit dem, was nur die App kennt — Anmeldung (Clerk),
 * Perspektive aus dem Story-Context (Perspektiven-Seite), Konfig-Texte und
 * Eingabegrenze der Library, Filter und Dokumentenzahl der Galerie, Belege
 * an die Galerie, KI-Hinweis, Konfig-Anzeige, Protokoll und Debug als
 * Fuesse. Ersetzt `ChatPanel variant="embedded"`.
 *
 * Die Auswahl in der Adresse (`q=`) bindet weiterhin `StoryAuswahlUrl`, die
 * aktive Sitzung teilen App und Paket ueber `useStorySitzungId`.
 */

import { useCallback, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useAtomValue, useSetAtom } from 'jotai'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { useLibraries } from '@ks/shell/react'
import type { DocReference } from '@ks/contracts'
import { chatReferencesAtom, galleryFiltersAtom, useGalleryData } from '@ks/module-explorer/react'
import { StoryRoot, type Nachricht, type Perspektive } from '@ks/module-story/react'
import { useStoryContext } from '@/hooks/use-story-context'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { getInitialGenderInclusive } from '@/components/library/chat/utils/chat-storage'
import { StoryAntwortFuss, StoryUebersichtFuss } from './story-fuss'

export function StoryRootMount({ libraryId }: { libraryId: string }) {
  const { isSignedIn } = useUser()
  const story = useStoryContext()
  const libraries = useLibraries()
  const { cfg, loading, error } = useLibraryConfig(libraryId)
  const filter = useAtomValue(galleryFiltersAtom)
  const setBelege = useSetAtom(chatReferencesAtom)
  // Gendergerechte Sprache: wie bisher aus dem gespeicherten Story-Kontext (Perspektiven-Seite schreibt ihn).
  const [genderInclusive] = useState(() => getInitialGenderInclusive())
  // Dokumente der (gefilterten) Galerie aus dem geteilten Zustand — kein zweiter Abruf.
  const galerie = useGalleryData(filter || {}, 'story', '', libraryId, { skipApiCall: true })

  const perspektive = useMemo<Perspektive>(
    () => ({
      targetLanguage: story.targetLanguage,
      character: story.character,
      accessPerspective: story.accessPerspective,
      socialContext: story.socialContext,
      genderInclusive,
      llmModel: story.llmModel,
    }),
    [story.targetLanguage, story.character, story.accessPerspective, story.socialContext, story.llmModel, genderInclusive],
  )

  // Konfig (publicPublishing.story): Texte ueber den Karten; Titel und Zweizeiler
  // der Library stehen seit D10 im Kopf der Seite (StoryModeHeader).
  const kopf = useMemo(() => {
    const library = libraries.find((lib) => lib.id === libraryId)
    const pub = library?.config?.publicPublishing
    return {
      themenTitel: pub?.story?.topicsTitle || undefined,
      themenIntro: pub?.story?.topicsIntro || undefined,
    }
  }, [libraries, libraryId])

  // D12e: folgt der gezeigten Antwort; ohne Antwort leer (rechts der Katalog).
  const onBelege = useCallback((references: DocReference[], queryId: string | null) => setBelege({ references, queryId: queryId ?? undefined }), [setBelege])
  const antwortFuss = useCallback(
    (antwort: Nachricht) => <StoryAntwortFuss libraryId={libraryId} antwort={antwort} llmModel={story.llmModel} />,
    [libraryId, story.llmModel],
  )
  const uebersichtFuss = useCallback(
    ({ queryId }: { queryId: string | null }) => <StoryUebersichtFuss libraryId={libraryId} queryId={queryId} llmModel={story.llmModel} />,
    [libraryId, story.llmModel],
  )

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade Story…</div>
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>
  if (!cfg) return <div className="p-6 text-sm text-muted-foreground">Keine Konfiguration gefunden.</div>

  return (
    <StoryRoot
      libraryId={libraryId}
      instanz={SAME_ORIGIN_API}
      viewer={{ isSignedIn: isSignedIn === true }}
      perspektive={perspektive}
      kopf={kopf}
      dokumente={galerie.loading ? 0 : galerie.totalCount || 0}
      filter={filter}
      eingabe={{ placeholder: cfg.config.placeholder, maxZeichen: cfg.config.maxChars, maxZeichenHinweis: cfg.config.maxCharsWarningMessage }}
      onBelege={onBelege}
      antwortFuss={antwortFuss}
      uebersichtFuss={uebersichtFuss}
      loeschenErlaubt
    />
  )
}
