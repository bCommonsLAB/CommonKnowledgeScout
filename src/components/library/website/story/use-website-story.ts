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

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { SAME_ORIGIN_API, useSessionHeaders } from '@ks/api-client'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { paare, useStoryKonversation, type Perspektive } from '@ks/module-story/react'
import { sichtbaresPaar } from '@/lib/website/story-sichtbares-paar'
import { useStoryContext } from '@/hooks/use-story-context'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { getInitialGenderInclusive } from '@/components/library/chat/utils/chat-storage'

/** Belege einer Antwort fuer das Blatt rechts. */
export interface BelegeBlatt {
  references: DocReference[]
  queryId: string | null
}

type SessionHeaders = ReturnType<typeof useSessionHeaders>

function alsHeaders(h: SessionHeaders): Record<string, string> | undefined {
  return Object.keys(h).length > 0 ? (h as Record<string, string>) : undefined
}

export function useWebsiteStory(libraryId: string) {
  const { isSignedIn } = useUser()
  const angemeldet = isSignedIn === true
  const story = useStoryContext()
  const { cfg, loading, error } = useLibraryConfig(libraryId)
  const [genderInclusive] = useState(() => getInitialGenderInclusive())
  const sessionHeaders = useSessionHeaders(angemeldet)

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

  const k = useStoryKonversation({
    libraryId,
    instanz: SAME_ORIGIN_API,
    isSignedIn: angemeldet,
    perspektive,
    // Keine Themenuebersicht auf der Startseite — nur Frage und Antwort.
    dokumente: null,
    ohneUebersicht: true,
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
    SAME_ORIGIN_API.fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs?limit=1`, { cache: 'no-store', headers: alsHeaders(sessionHeaders) })
      .then(async (res) => {
        const json = (await res.json()) as { total?: unknown; error?: unknown }
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
        if (!abgebrochen && typeof json.total === 'number') setKatalogAnzahl(json.total)
      })
      .catch((e: unknown) => console.error('[useWebsiteStory] Katalog-Zahl nicht ladbar', e))
    return () => { abgebrochen = true }
  }, [libraryId, sessionHeaders])

  return { k, paare: alle, sichtbar, perspektive, cfg, loading, error, llmModel: story.llmModel, katalogAnzahl, sessionHeaders }
}

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
