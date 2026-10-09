'use client'

/**
 * Die Story-Perspektive im Benutzerprofil (Owner 09.10.2026).
 *
 * Angemeldet gilt das Profil, nicht der Browser: Beim ersten Mount holt der
 * Hook die gespeicherte Perspektive (`GET /api/user/story-perspektive`),
 * schreibt sie in die Story-Atome und den localStorage und setzt damit auch
 * den Eintrag „Perspektive gewaehlt" — in einem neuen Browser fragt der
 * Dialog dann nicht. Hat das Profil noch keine, der Browser aber schon,
 * wandert die des Browsers ins Profil. Anonym bleibt alles im Browser.
 *
 * `stand` ist `laedt`, bis feststeht, was gilt; erst dann darf der
 * Erstbesuch-Dialog entscheiden.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import type { ProfilPerspektiveDto } from '@ks/contracts'
import {
  storyAccessPerspectiveAtom,
  storyCharacterAtom,
  storyLlmModelAtom,
  storySocialContextAtom,
  storyTargetLanguageAtom,
} from '@/atoms/story-context-atom'
import { saveStoryContextToLocalStorage } from '@/hooks/use-story-context'

const PFAD = '/api/user/story-perspektive'
const FLAG = 'story-perspective-set'

export type ProfilStand = 'laedt' | 'fertig'

async function profilSchreiben(p: ProfilPerspektiveDto): Promise<void> {
  const res = await fetch(PFAD, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
}

export interface ProfilPerspektive {
  stand: ProfilStand
  /** Legt eine Wahl im Profil ab (nur angemeldet; sonst nichts zu tun). */
  speichern: (p: ProfilPerspektiveDto) => void
  /** Legt die gerade geltende Perspektive ab — fuer „weggeklickt, mit Voreinstellung weiter". */
  aktuelleSpeichern: () => void
}

export function useProfilPerspektive(): ProfilPerspektive {
  const { isLoaded, isSignedIn } = useUser()
  const [geladen, setGeladen] = useState(false)
  const gestartet = useRef(false)
  const lokal: ProfilPerspektiveDto = {
    targetLanguage: useAtomValue(storyTargetLanguageAtom),
    character: useAtomValue(storyCharacterAtom),
    accessPerspective: useAtomValue(storyAccessPerspectiveAtom),
    socialContext: useAtomValue(storySocialContextAtom),
    llmModel: useAtomValue(storyLlmModelAtom) ?? '',
  }
  const lokalRef = useRef(lokal)
  lokalRef.current = lokal
  const setSprache = useSetAtom(storyTargetLanguageAtom)
  const setInteressen = useSetAtom(storyCharacterAtom)
  const setZugang = useSetAtom(storyAccessPerspectiveAtom)
  const setStil = useSetAtom(storySocialContextAtom)
  const setModell = useSetAtom(storyLlmModelAtom)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || gestartet.current) return
    gestartet.current = true
    fetch(PFAD)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { perspektive } = (await res.json()) as { perspektive: ProfilPerspektiveDto | null }
        if (perspektive) {
          setSprache(perspektive.targetLanguage)
          setInteressen(perspektive.character)
          setZugang(perspektive.accessPerspective)
          setStil(perspektive.socialContext)
          setModell(perspektive.llmModel)
          saveStoryContextToLocalStorage(perspektive.targetLanguage, perspektive.character, perspektive.socialContext, perspektive.accessPerspective, perspektive.llmModel, false)
          return
        }
        // Profil leer, Browser hat schon gewaehlt: die Wahl des Browsers wird die des Profils.
        const b = lokalRef.current
        if (localStorage.getItem(FLAG) === 'true' && b.llmModel !== '') await profilSchreiben(b)
      })
      .catch((e: unknown) => {
        // Dann gilt der Browser — sichtbar in der Konsole, der Dialog funktioniert weiter.
        console.error('[useProfilPerspektive] Profil-Perspektive nicht ladbar', e)
      })
      .finally(() => setGeladen(true))
  }, [isLoaded, isSignedIn, setSprache, setInteressen, setZugang, setStil, setModell])

  const speichern = useCallback(
    (p: ProfilPerspektiveDto) => {
      if (!isSignedIn) return
      profilSchreiben(p).catch((e: unknown) => {
        console.error('[useProfilPerspektive] Profil-Perspektive nicht speicherbar', e)
        toast.error('Die Perspektive gilt in diesem Browser, konnte aber nicht im Profil gespeichert werden.')
      })
    },
    [isSignedIn],
  )

  const aktuelleSpeichern = useCallback(() => {
    if (lokalRef.current.llmModel === '') {
      console.warn('[useProfilPerspektive] Noch kein Modell — Profil bleibt leer, der naechste Browser fragt erneut')
      return
    }
    speichern(lokalRef.current)
  }, [speichern])

  const stand: ProfilStand = !isLoaded ? 'laedt' : !isSignedIn ? 'fertig' : geladen ? 'fertig' : 'laedt'
  return { stand, speichern, aktuelleSpeichern }
}
