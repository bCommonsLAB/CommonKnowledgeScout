'use client'

/**
 * Verdrahtung der Story-Sektion mit der App (Welle N1): Anmeldung (Clerk),
 * Perspektive aus dem Story-Kontext, Eingabegrenze aus der Library-Konfig,
 * die Konversation aus `@ks/module-story` OHNE Themenuebersicht, dazu die
 * Zahl des Katalogs und die zitierten Dokumente fuer die Belegliste.
 *
 * Dieselbe Sitzung wie der Story-Modus (`useStorySitzungId` im Hook): Was
 * hier gefragt wird, steht dort in der Chronik.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { SAME_ORIGIN_API, useSessionHeaders } from '@ks/api-client'
import type { DocCardMeta, DocReference, GalleryFilters } from '@ks/contracts'
import { paare, useStoryKonversation, type Perspektive } from '@ks/module-story/react'
import { sichtbaresPaar } from '@/lib/website/story-sichtbares-paar'
import { useStoryContext } from '@/hooks/use-story-context'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { getInitialGenderInclusive } from '@/components/library/chat/utils/chat-storage'
import type { TargetLanguage } from '@/lib/chat/constants'
import { storyFilterParams } from '@/lib/website/story-filter'

/** Belege einer Antwort fuer das Blatt rechts. */
export interface BelegeBlatt {
  references: DocReference[]
  queryId: string | null
}

type SessionHeaders = ReturnType<typeof useSessionHeaders>

function alsHeaders(h: SessionHeaders): Record<string, string> | undefined {
  return Object.keys(h).length > 0 ? (h as Record<string, string>) : undefined
}

/**
 * `filter`: Facettenfilter der Sektion (`filter="year=2026"`) — gilt fuer Chat, Belege und die Zahl des Katalogs.
 * `regelsatz`: benannter Regelsatz der Sektion (`rules=einladung`, Owner 09.11.2026) — geht als `rules` an den Stream.
 */
export function useWebsiteStory(libraryId: string, filter?: GalleryFilters, regelsatz?: string) {
  const { isSignedIn } = useUser()
  const angemeldet = isSignedIn === true
  const story = useStoryContext()
  const { cfg, loading, error } = useLibraryConfig(libraryId)
  const [genderInclusive] = useState(() => getInitialGenderInclusive())
  // Antwortsprache (Owner 09.11.2026): Die Startseite antwortet in der Sprache der
  // Oberflaeche ('global' loest der Server aus der Locale auf), nicht in einer frueher
  // im Browser gespeicherten Wahl. Erst wenn die Person hier im Dialog „Antworten
  // anpassen" eine Sprache waehlt, gilt diese fuer den Besuch.
  const startSprache = useRef(story.targetLanguage)
  const [spracheGewaehlt, setSpracheGewaehlt] = useState<TargetLanguage | null>(null)
  useEffect(() => {
    if (story.targetLanguage !== startSprache.current) setSpracheGewaehlt(story.targetLanguage)
  }, [story.targetLanguage])
  const targetLanguage: TargetLanguage = spracheGewaehlt ?? 'global'
  const sessionHeaders = useSessionHeaders(angemeldet)

  const perspektive = useMemo<Perspektive>(
    () => ({
      targetLanguage,
      character: story.character,
      accessPerspective: story.accessPerspective,
      socialContext: story.socialContext,
      genderInclusive,
      llmModel: story.llmModel,
    }),
    [targetLanguage, story.character, story.accessPerspective, story.socialContext, story.llmModel, genderInclusive],
  )

  const k = useStoryKonversation({
    libraryId,
    instanz: SAME_ORIGIN_API,
    isSignedIn: angemeldet,
    perspektive,
    // Keine Themenuebersicht auf der Startseite — nur Frage und Antwort.
    dokumente: null,
    ohneUebersicht: true,
    filter,
    regelsatz,
    maxZeichen: cfg?.config.maxChars,
    maxZeichenHinweis: cfg?.config.maxCharsWarningMessage,
  })
  // Alle Paare der Sitzung fuer Zaehler und Verweis; sichtbar ist nur das
  // juengste (wie eine Suche, Owner 08.11.2026).
  const alle = useMemo(() => paare(k.nachrichten), [k.nachrichten])
  const sichtbar = useMemo(() => sichtbaresPaar(alle), [alle])

  // Zahl des Katalogs fuer den Weg „alle Quellen" in der Belegliste (anonym lesbar).
  const [katalogAnzahl, setKatalogAnzahl] = useState<number>(0)
  useEffect(() => {
    let abgebrochen = false
    const params = storyFilterParams(filter, new URLSearchParams({ limit: '1' }))
    SAME_ORIGIN_API.fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs?${params.toString()}`, { cache: 'no-store', headers: alsHeaders(sessionHeaders) })
      .then(async (res) => {
        const json = (await res.json()) as { total?: unknown; error?: unknown }
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
        if (!abgebrochen && typeof json.total === 'number') setKatalogAnzahl(json.total)
      })
      .catch((e: unknown) => console.error('[useWebsiteStory] Katalog-Zahl nicht ladbar', e))
    return () => { abgebrochen = true }
    // `filterSchluessel` steht fuer den Inhalt des Filters (Objekt je Render neu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, sessionHeaders, JSON.stringify(filter ?? {})])

  return { k, paare: alle, sichtbar, perspektive, cfg, loading, error, llmModel: story.llmModel, katalogAnzahl, sessionHeaders }
}

/** Was die Sektion aus dem Hook bekommt — fuer den ausgelagerten Konversationsblock. */
export type WebsiteStoryStand = ReturnType<typeof useWebsiteStory>

/**
 * Die zitierten Dokumente einer Antwort als `DocCardMeta` (Titel, Slug,
 * Plakette, Kennzeile) — derselbe Endpunkt, mit dem die Galerie fehlende
 * Referenz-Dokumente nachlaedt. Leer, solange nichts zitiert ist.
 */
export function useBelegDokumente(libraryId: string, references: DocReference[], sessionHeaders: SessionHeaders): DocCardMeta[] {
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const fileIds = useMemo(() => Array.from(new Set(references.map((r) => r.fileId))).sort(), [references])
  const schluessel = fileIds.join('|')

  useEffect(() => {
    if (fileIds.length === 0) { setDocs([]); return }
    let abgebrochen = false
    const params = new URLSearchParams()
    for (const id of fileIds) params.append('fileId', id)
    SAME_ORIGIN_API.fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs/by-fileids?${params.toString()}`, { cache: 'no-store', headers: alsHeaders(sessionHeaders) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { items?: unknown }
        if (!abgebrochen) setDocs(Array.isArray(json.items) ? (json.items as DocCardMeta[]) : [])
      })
      .catch((e: unknown) => {
        console.error('[useBelegDokumente] Zitierte Dokumente nicht ladbar', e)
        if (!abgebrochen) setDocs([])
      })
    return () => { abgebrochen = true }
    // `schluessel` steht fuer die Menge der fileIds; `fileIds` selbst ist je Render neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, schluessel, sessionHeaders])

  return docs
}
