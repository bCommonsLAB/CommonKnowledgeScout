/**
 * Verdrahtung der Story-Mitte (D6b): Sitzung, Verlauf, Stream und die drei
 * Story-Atome (Auswahl, Gliederung, aktive Sitzung) — das, was in der App
 * `use-story-auswahl-bridge`, `use-chat-toc` und `use-story-toc-autostart`
 * zusammen tun, auf das Noetige verdichtet.
 *
 * Klickmodell: Eine gesendete Frage wird die aktive Konversation; ihr Thema
 * (falls aus einem Thema gewaehlt) markiert die Gliederung. Sobald die
 * gespeicherte Kennung da ist, traegt die Auswahl sie nach (die App schreibt
 * sie in die Adresse, D2). Die Themenuebersicht wird einmal je Filter- und
 * Perspektiven-Stand geholt, sobald Dokumente da sind.
 *
 * Belege (D12e): `onBelege` folgt der gezeigten Antwort — frisch oder aus
 * der Chronik, `?q=`, Zurueck-Knopf gewaehlt. Uebersicht, Themenseite und
 * eine noch laufende Frage melden leere Belege (rechts dann der Katalog).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { useSessionHeaders, type InstanceApi } from '@ks/api-client'
import type { DocReference, GalleryFilters, StoryTopicsData } from '@ks/contracts'
import { storyAktiveSitzungAtom, storyAuswahlAtom, storyGliederungAtom, storySitzungenStandAtom } from '../atoms'
import { themaZuFrage } from '../thema-zu-frage'
import { STORY_UEBERSICHT } from '../types'
import { ANTWORT_LAENGE_STANDARD, type AntwortLaenge, type Nachricht, type Perspektive } from '../konversation/types'
import { useStoryStream } from '../konversation/use-story-stream'
import { useStoryVerlauf } from '../konversation/use-story-verlauf'
import { fragenAusVerlauf, frageZurAuswahl, konversationAuswaehlen, paare } from '../konversation/verlauf'
import { useStorySitzungId } from './use-story-sitzung-id'

export interface UseStoryKonversationParams {
  libraryId: string
  instanz: InstanceApi
  isSignedIn: boolean
  perspektive: Perspektive
  filter?: GalleryFilters
  /** Dokumente im (gefilterten) Bestand; ohne Dokumente keine Uebersicht. */
  dokumente: number
  /** Belege der gezeigten Antwort; leer (und `queryId` null), wenn keine Antwort gezeigt wird. */
  onBelege?: (belege: DocReference[], queryId: string | null) => void
  maxZeichen?: number
  maxZeichenHinweis?: string
}

export function useStoryKonversation(p: UseStoryKonversationParams) {
  const { libraryId, instanz, isSignedIn, perspektive, filter, dokumente, onBelege } = p
  const { chatId, setChatId } = useStorySitzungId(libraryId)
  const [auswahl, setAuswahl] = useAtom(storyAuswahlAtom)
  const [gliederung, setGliederung] = useAtom(storyGliederungAtom)
  const setAktiveSitzung = useSetAtom(storyAktiveSitzungAtom)
  const setSitzungenStand = useSetAtom(storySitzungenStandAtom)
  const [antwortLaenge, setAntwortLaenge] = useState<AntwortLaenge>(ANTWORT_LAENGE_STANDARD)
  const [fehler, setFehler] = useState<string | null>(null)
  /** Technische Meldung zum Klartext in `fehler` (D10d). */
  const [fehlerDetail, setFehlerDetail] = useState<string | null>(null)
  const [uebersichtLaeuft, setUebersichtLaeuft] = useState(false)
  /** Gespeicherte Kennung der Themenuebersicht (fuer Konfig-Anzeige und Quellen des Gastgebers). */
  const [uebersichtQueryId, setUebersichtQueryId] = useState<string | null>(null)
  const sessionHeaders = useSessionHeaders(isSignedIn)
  /** Fuer welchen Stand (Filter + Perspektive) die Uebersicht zuletzt geholt wurde. */
  const uebersichtStand = useRef<string | null>(null)

  const verlauf = useStoryVerlauf({ libraryId, instanz, isSignedIn, chatId })
  const { nachrichten, setNachrichten } = verlauf

  const onUebersicht = useCallback(
    (g: StoryTopicsData | null, queryId: string) => {
      setGliederung(g)
      setUebersichtQueryId(queryId)
      setUebersichtLaeuft(false)
    },
    [setGliederung],
  )
  const onFehler = useCallback((text: string, detail?: string) => {
    setFehler(text)
    setFehlerDetail(detail ?? null)
    setUebersichtLaeuft(false)
  }, [])

  // Gesendete Frage → aktive Konversation; ihr Thema (falls aus einem Thema gewaehlt) markiert die Gliederung.
  const gliederungRef = useRef(gliederung)
  gliederungRef.current = gliederung
  const onFrage = useCallback(
    (frage: Nachricht) => setAuswahl({ art: 'konversation', frageId: frage.id, themaId: themaZuFrage(gliederungRef.current, frage.text) ?? undefined }),
    [setAuswahl],
  )

  const stream = useStoryStream({
    libraryId, instanz, isSignedIn,
    rahmen: { perspektive, antwortLaenge, filter, chatId },
    nachrichten, setNachrichten,
    onSitzung: setChatId, onFrage, onUebersicht, onFehler,
    maxZeichen: p.maxZeichen, maxZeichenHinweis: p.maxZeichenHinweis,
  })
  const { laeuft, uebersichtLaden } = stream

  // Chronik: Fragen der aktiven Sitzung live aus dem Verlauf.
  useEffect(() => {
    setAktiveSitzung({ chatId, fragen: fragenAusVerlauf(nachrichten, laeuft) })
  }, [chatId, nachrichten, laeuft, setAktiveSitzung])

  // Themenuebersicht einmal je Stand holen — erst mit Dokumenten und Modell.
  const stand = JSON.stringify({ filter: filter ?? {}, perspektive })
  useEffect(() => {
    if (dokumente < 1 || !perspektive.llmModel || laeuft) return
    if (uebersichtStand.current === stand) return
    uebersichtStand.current = stand
    setGliederung(null)
    setUebersichtLaeuft(true)
    void uebersichtLaden()
  }, [stand, dokumente, perspektive.llmModel, laeuft, uebersichtLaden, setGliederung])

  const uebersichtNeu = useCallback(() => {
    if (laeuft) return
    setGliederung(null)
    setUebersichtLaeuft(true)
    void uebersichtLaden(true)
  }, [laeuft, uebersichtLaden, setGliederung])

  // D12e: Belege der gezeigten Antwort an den Gastgeber — bei jeder Auswahl, nicht nur
  // bei einer frischen Antwort. Keine Antwort (Uebersicht, Thema, laufende Frage): leer.
  const paareDerAuswahl = useMemo(() => paare(konversationAuswaehlen(nachrichten, auswahl)), [nachrichten, auswahl])
  const gezeigteAntwort = useMemo(
    () => (auswahl.art === 'konversation' ? [...paareDerAuswahl].reverse().find((p) => p.antwort)?.antwort ?? null : null),
    [auswahl.art, paareDerAuswahl],
  )
  const onBelegeRef = useRef(onBelege)
  onBelegeRef.current = onBelege
  useEffect(() => {
    onBelegeRef.current?.(gezeigteAntwort?.belege ?? [], gezeigteAntwort?.queryId ?? null)
  }, [gezeigteAntwort])

  // Gespeicherte Kennung und Thema nachtragen, sobald bekannt.
  useEffect(() => {
    if (auswahl.art !== 'konversation') return
    const frage = frageZurAuswahl(nachrichten, auswahl)
    if (!frage) return
    const queryId = auswahl.queryId ?? frage.queryId
    const themaId = auswahl.themaId ?? themaZuFrage(gliederung, frage.text) ?? undefined
    if (queryId !== auswahl.queryId || themaId !== auswahl.themaId) setAuswahl({ ...auswahl, queryId, themaId })
  }, [auswahl, nachrichten, gliederung, setAuswahl])

  const frageSenden = useCallback(
    async (text: string) => {
      setFehler(null)
      setFehlerDetail(null)
      await stream.frageSenden(text)
    },
    [stream],
  )

  // Frage loeschen (D6c): `DELETE …/queries/<queryId>` ueber die Instanz; die
  // Nachrichten fallen aus dem Verlauf, eine geloeschte Auswahl kehrt zur
  // Uebersicht zurueck. Ein Serverfehler bleibt sichtbar.
  // D12f: War es die letzte gespeicherte Frage der Sitzung, wird auch die
  // Sitzung geloescht (`DELETE …/chats/<chatId>`) und die Mitte beginnt eine
  // neue — sonst bliebe ein leerer Chat mit dem Kurztitel der geloeschten
  // Frage stehen, in dem die naechste Frage unter altem Titel landet.
  const frageLoeschen = useCallback(
    async (queryId: string) => {
      setFehler(null)
      setFehlerDetail(null)
      const basis = `/api/chat/${encodeURIComponent(libraryId)}`
      try {
        const res = await instanz.fetch(`${basis}/queries/${encodeURIComponent(queryId)}`, { method: 'DELETE', headers: sessionHeaders })
        if (!res.ok) throw new Error(`Frage löschen: HTTP ${res.status}`)
        const rest = nachrichten.filter((m) => m.queryId !== queryId)
        setNachrichten(rest)
        if (auswahl.art === 'konversation' && auswahl.queryId === queryId) setAuswahl(STORY_UEBERSICHT)
        if (chatId && !rest.some((m) => m.queryId)) {
          const resChat = await instanz.fetch(`${basis}/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE', headers: sessionHeaders })
          if (!resChat.ok) throw new Error(`Leere Sitzung löschen: HTTP ${resChat.status}`)
          setChatId(null)
          setSitzungenStand((n) => n + 1)
        }
      } catch (e) {
        console.error('[useStoryKonversation] Frage nicht gelöscht', e)
        setFehler(e instanceof Error ? e.message : String(e))
      }
    },
    [instanz, libraryId, sessionHeaders, nachrichten, setNachrichten, auswahl, setAuswahl, chatId, setChatId, setSitzungenStand],
  )

  return {
    chatId,
    auswahl,
    setAuswahl,
    gliederung,
    nachrichten,
    verlaufLadend: verlauf.ladend,
    paareDerAuswahl,
    laeuft,
    schritte: stream.schritte,
    uebersichtLaeuft,
    uebersichtQueryId,
    fehler: fehler ?? verlauf.fehler,
    fehlerDetail: fehler ? fehlerDetail : null,
    antwortLaenge,
    setAntwortLaenge,
    frageSenden,
    uebersichtNeu,
    frageLoeschen,
  }
}
