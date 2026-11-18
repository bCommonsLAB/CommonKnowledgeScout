'use client'

/**
 * Themenuebersicht fuer die Sektion `layout=topics` (Owner 18.11.2026): die
 * Gliederung, die auch der Story-Modus berechnet — Systemfrage
 * `STORY_TOC_QUESTION` ueber `useStoryStream`, also ueber den Antwort-Cache
 * des Servers. Perspektive wie die Story-Sektion (`useWebsitePerspektive`),
 * aber OHNE deren Regelsatz: Regelsaetze formen Antworten, nicht die
 * Gliederung, und ohne ihn trifft die Startseite denselben Cache wie der
 * Story-Modus. Die Uebersicht eroeffnet keine Sitzung (D8).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { useTranslation } from '@ks/i18n/react'
import type { StoryTopicsData } from '@ks/contracts'
import { ANTWORT_LAENGE_STANDARD, useStoryStream, type AnfrageRahmen, type Nachricht } from '@ks/module-story/react'
import { useWebsitePerspektive } from './use-website-perspektive'

export interface WebsiteThemenStand {
  /** `null`, solange die Uebersicht laedt oder wenn sie fehlt (dann steht `fehler`). */
  gliederung: StoryTopicsData | null
  laedt: boolean
  /** Klartext fuer die Seite; die technische Meldung steht in der Konsole. */
  fehler: string | null
}

export function useWebsiteThemen(libraryId: string): WebsiteThemenStand {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const perspektive = useWebsitePerspektive()
  // Der Stream verlangt einen Verlauf; die Uebersicht traegt nichts ein (kein Eintrag ohne Frage).
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
  const [gliederung, setGliederung] = useState<StoryTopicsData | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const onUebersicht = useCallback(
    (g: StoryTopicsData | null) => {
      if (g === null || g.topics.length === 0) {
        console.error('[useWebsiteThemen] Der Server lieferte keine Themen', g)
        setFehler(t('website.story.themenFehlen'))
      }
      setGliederung(g)
      setLaedt(false)
    },
    [t],
  )
  const onFehler = useCallback((text: string, detail?: string) => {
    console.error('[useWebsiteThemen] Themenuebersicht nicht ladbar', detail ?? text)
    setFehler(text)
    setLaedt(false)
  }, [])
  const onSitzung = useCallback((chatId: string) => {
    console.warn('[useWebsiteThemen] Die Themenuebersicht meldete eine Sitzung — erwartet keine (D8)', chatId)
  }, [])

  const rahmen = useMemo<AnfrageRahmen>(() => ({ perspektive, antwortLaenge: ANTWORT_LAENGE_STANDARD, chatId: null }), [perspektive])
  const { laeuft, uebersichtLaden } = useStoryStream({
    libraryId,
    instanz: SAME_ORIGIN_API,
    isSignedIn: isSignedIn === true,
    rahmen,
    nachrichten,
    setNachrichten,
    onSitzung,
    onUebersicht,
    onFehler,
  })

  // Einmal je Perspektive holen — erst mit Modell (der Server antwortet ohne nicht).
  const stand = JSON.stringify(perspektive)
  const geholtFuer = useRef<string | null>(null)
  useEffect(() => {
    if (!perspektive.llmModel || laeuft || geholtFuer.current === stand) return
    geholtFuer.current = stand
    setFehler(null)
    setLaedt(true)
    void uebersichtLaden()
  }, [stand, perspektive.llmModel, laeuft, uebersichtLaden])

  return { gliederung, laedt, fehler }
}
