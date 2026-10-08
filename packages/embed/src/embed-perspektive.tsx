'use client'

/**
 * Die eigene Perspektive im Embed (`enablePerspective`, Owner 08.10.2026).
 *
 * Ohne Wahl gilt wie bisher die Chat-Konfiguration der Library. Waehlt die
 * Besucherin im Dialog Interessen, Zugang und Sprachstil, merkt sich ihr
 * Browser das je Library (localStorage) — ohne Anmeldung, wie die
 * Sitzungskennung. Sprache (`locale`) und Modell (erstes oeffentliches)
 * stehen fest und werden nicht gespeichert.
 *
 * Die Wahl lebt in einem Atom des Embed-Speichers: Kopf (Knopf + Dialog) und
 * Mitte (Fragen) lesen dieselbe. Jede neue Perspektive laesst die Instanz die
 * Themenuebersicht einmal neu rechnen (ein Modell-Aufruf).
 */

import { useEffect } from 'react'
import { atom, useAtom } from 'jotai'
import type { AccessPerspective, Character, SocialContext, TargetLanguage } from '@ks/contracts'
import { ACCESS_PERSPECTIVE_VALUES, CHARACTER_VALUES, SOCIAL_CONTEXT_VALUES } from '@ks/contracts'
import type { ExplorerLibraryPayload } from '@ks/module-explorer/react'
import type { Perspektive, PerspektivWahl } from '@ks/module-story/react'

/** Was die Besucherin selbst waehlt. */
export interface EigenePerspektive {
  character: Character[]
  accessPerspective: AccessPerspective[]
  socialContext: SocialContext
}

export const eigenePerspektiveAtom = atom<EigenePerspektive | null>(null)
export const perspektiveDialogAtom = atom(false)

const schluessel = (libraryId: string) => `ks-embed-perspektive:${libraryId}`

function liste<T extends string>(roh: unknown, erlaubt: readonly T[]): T[] | null {
  if (!Array.isArray(roh) || roh.length === 0) return null
  return roh.every((w) => (erlaubt as readonly unknown[]).includes(w)) ? (roh as T[]) : null
}

/** Gespeicherten Wert pruefen; was nicht passt, wird gemeldet und nicht genommen. */
export function ausGespeichert(roh: unknown): EigenePerspektive | null {
  const o = (typeof roh === 'object' && roh !== null ? roh : {}) as Record<string, unknown>
  const character = liste(o.character, CHARACTER_VALUES)
  const accessPerspective = liste(o.accessPerspective, ACCESS_PERSPECTIVE_VALUES)
  const socialContext = (SOCIAL_CONTEXT_VALUES as readonly unknown[]).includes(o.socialContext) ? (o.socialContext as SocialContext) : null
  if (!character || !accessPerspective || !socialContext) return null
  return { character, accessPerspective, socialContext }
}

type Chat = ExplorerLibraryPayload['chat']

/** Die Perspektive fuer die Fragen: eigene Wahl, sonst die Konfig der Library (wie bisher). */
export function perspektiveFuer(chat: Chat, locale: TargetLanguage, modell: string, eigene: EigenePerspektive | null): Perspektive {
  return {
    targetLanguage: locale,
    character: eigene?.character ?? chat?.character ?? [],
    accessPerspective: eigene?.accessPerspective ?? [],
    socialContext: eigene?.socialContext ?? chat?.socialContext ?? 'undefined',
    genderInclusive: chat?.genderInclusive ?? true,
    llmModel: modell,
  }
}

/** Der Startwert des Dialogs: leere Listen heissen dort „nicht festgelegt". */
export function wahlFuerDialog(p: Perspektive): PerspektivWahl {
  return {
    targetLanguage: p.targetLanguage,
    character: p.character.length > 0 ? p.character : ['undefined'],
    accessPerspective: p.accessPerspective.length > 0 ? p.accessPerspective : ['undefined'],
    socialContext: p.socialContext,
    llmModel: p.llmModel,
  }
}

/** Die eigene Perspektive dieser Library — geladen beim ersten Mal, gespeichert bei jeder Wahl. */
export function useEigenePerspektive(libraryId: string, aktiv: boolean): [EigenePerspektive | null, (wahl: PerspektivWahl) => void] {
  const [eigene, setEigene] = useAtom(eigenePerspektiveAtom)

  useEffect(() => {
    if (!aktiv) return
    let roh: string | null
    try {
      roh = localStorage.getItem(schluessel(libraryId))
    } catch (e) {
      console.warn('[KnowledgeScoutExplorer] Perspektive nicht lesbar (localStorage gesperrt) — es gilt die der Library', e)
      return
    }
    if (roh === null) return
    let gelesen: EigenePerspektive | null = null
    try {
      gelesen = ausGespeichert(JSON.parse(roh))
    } catch (e) {
      console.warn('[KnowledgeScoutExplorer] Gespeicherte Perspektive ist kein JSON', e)
    }
    if (!gelesen) console.warn('[KnowledgeScoutExplorer] Gespeicherte Perspektive passt nicht — es gilt die der Library')
    setEigene(gelesen)
  }, [aktiv, libraryId, setEigene])

  function speichern(wahl: PerspektivWahl) {
    const neu: EigenePerspektive = { character: wahl.character, accessPerspective: wahl.accessPerspective, socialContext: wahl.socialContext }
    setEigene(neu)
    try {
      localStorage.setItem(schluessel(libraryId), JSON.stringify(neu))
    } catch (e) {
      console.warn('[KnowledgeScoutExplorer] Perspektive nicht speicherbar — gilt nur bis zum Neuladen', e)
    }
  }

  return [eigene, speichern]
}
