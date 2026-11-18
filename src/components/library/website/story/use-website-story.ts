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
import type { DocCardMeta, DocReference, GalleryFilters } from '@ks/contracts'
import { paare, useNeuStellen, useStoryKonversation } from '@ks/module-story/react'
import { sichtbaresPaar, storyFilterParams } from '@ks/module-website'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useWebsitePerspektive } from './use-website-perspektive'

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
  const { cfg, loading, error } = useLibraryConfig(libraryId)
  // Antwortsprache und uebrige Perspektive: geteilt mit der Themen-Sektion (`use-website-perspektive.ts`).
  const perspektive = useWebsitePerspektive()
  const sessionHeaders = useSessionHeaders(angemeldet)

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
  // Nach „Mit dieser Perspektive starten": die sichtbare Frage neu stellen, ohne weiteren Klick.
  useNeuStellen({ stand: k.stand, laeuft: k.laeuft, frage: sichtbar.paar?.frage.text ?? null, frageSenden: k.frageSenden })

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

  return { k, paare: alle, sichtbar, perspektive, cfg, loading, error, llmModel: perspektive.llmModel, katalogAnzahl, sessionHeaders }
}

/** Was die Sektion aus dem Hook bekommt — fuer den ausgelagerten Konversationsblock. */
export type WebsiteStoryStand = ReturnType<typeof useWebsiteStory>

/**
 * Die zitierten Dokumente einer Antwort als `DocCardMeta` (Titel, Slug,
 * Plakette, Kennzeile) — derselbe Endpunkt, mit dem die Galerie fehlende
 * Referenz-Dokumente nachlaedt. Leer, solange nichts zitiert ist.
 */
export function useBelegDokumente(libraryId: string, references: DocReference[], sessionHeaders: SessionHeaders): DocCardMeta[] {
  return useBelegDokumenteStand(libraryId, references, sessionHeaders).docs
}

/**
 * Wie `useBelegDokumente`, dazu `laedt`: true, solange die Dokumente zu DIESEN
 * Referenzen noch unterwegs sind. Die Karten-Darstellungen zeigen so lange
 * Platzhalter, statt erst die Textantwort und Sekunden spaeter die Karten
 * (Owner 10.11.2026).
 */
export function useBelegDokumenteStand(libraryId: string, references: DocReference[], sessionHeaders: SessionHeaders): { docs: DocCardMeta[]; laedt: boolean } {
  const [stand, setStand] = useState<{ docs: DocCardMeta[]; fuer: string }>({ docs: [], fuer: '' })
  const setDocs = (docs: DocCardMeta[], fuer: string) => setStand({ docs, fuer })
  const fileIds = useMemo(() => Array.from(new Set(references.map((r) => r.fileId))).sort(), [references])
  const schluessel = fileIds.join('|')

  useEffect(() => {
    if (fileIds.length === 0) { setDocs([], ''); return }
    let abgebrochen = false
    const params = new URLSearchParams()
    for (const id of fileIds) params.append('fileId', id)
    SAME_ORIGIN_API.fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs/by-fileids?${params.toString()}`, { cache: 'no-store', headers: alsHeaders(sessionHeaders) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { items?: unknown }
        if (!abgebrochen) setDocs(Array.isArray(json.items) ? (json.items as DocCardMeta[]) : [], schluessel)
      })
      .catch((e: unknown) => {
        console.error('[useBelegDokumente] Zitierte Dokumente nicht ladbar', e)
        if (!abgebrochen) setDocs([], schluessel)
      })
    return () => { abgebrochen = true }
    // `schluessel` steht fuer die Menge der fileIds; `fileIds` selbst ist je Render neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, schluessel, sessionHeaders])

  // Dokumente eines frueheren Referenz-Satzes gelten nicht fuer den neuen.
  const aktuell = stand.fuer === schluessel
  return { docs: aktuell ? stand.docs : [], laedt: fileIds.length > 0 && !aktuell }
}
