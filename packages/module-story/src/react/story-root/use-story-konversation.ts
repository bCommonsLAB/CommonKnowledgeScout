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
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import type { InstanceApi } from '@ks/api-client'
import type { DocReference, GalleryFilters, StoryTopicsData } from '@ks/contracts'
import { storyAktiveSitzungAtom, storyAuswahlAtom, storyGliederungAtom } from '../atoms'
import { themaZuFrage } from '../thema-zu-frage'
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
  onBelege?: (belege: DocReference[], queryId: string) => void
  maxZeichen?: number
  maxZeichenHinweis?: string
}

export function useStoryKonversation(p: UseStoryKonversationParams) {
  const { libraryId, instanz, isSignedIn, perspektive, filter, dokumente, onBelege } = p
  const { chatId, setChatId } = useStorySitzungId(libraryId)
  const [auswahl, setAuswahl] = useAtom(storyAuswahlAtom)
  const [gliederung, setGliederung] = useAtom(storyGliederungAtom)
  const setAktiveSitzung = useSetAtom(storyAktiveSitzungAtom)
  const [antwortLaenge, setAntwortLaenge] = useState<AntwortLaenge>(ANTWORT_LAENGE_STANDARD)
  const [fehler, setFehler] = useState<string | null>(null)
  const [uebersichtLaeuft, setUebersichtLaeuft] = useState(false)
  /** Fuer welchen Stand (Filter + Perspektive) die Uebersicht zuletzt geholt wurde. */
  const uebersichtStand = useRef<string | null>(null)

  const verlauf = useStoryVerlauf({ libraryId, instanz, isSignedIn, chatId })
  const { nachrichten, setNachrichten } = verlauf

  const onUebersicht = useCallback(
    (g: StoryTopicsData | null) => {
      setGliederung(g)
      setUebersichtLaeuft(false)
    },
    [setGliederung],
  )
  const onFehler = useCallback((text: string) => {
    setFehler(text)
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
    onSitzung: setChatId, onFrage, onBelege, onUebersicht, onFehler,
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
      await stream.frageSenden(text)
    },
    [stream],
  )

  return {
    chatId,
    auswahl,
    setAuswahl,
    gliederung,
    nachrichten,
    verlaufLadend: verlauf.ladend,
    paareDerAuswahl: paare(konversationAuswaehlen(nachrichten, auswahl)),
    laeuft,
    schritte: stream.schritte,
    uebersichtLaeuft,
    fehler: fehler ?? verlauf.fehler,
    antwortLaenge,
    setAntwortLaenge,
    frageSenden,
    uebersichtNeu,
  }
}
