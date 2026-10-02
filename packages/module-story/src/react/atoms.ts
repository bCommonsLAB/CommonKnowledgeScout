/**
 * Geteilter Zustand zwischen Chronik (links) und Mitte.
 *
 * Beide Spalten werden ueber getrennte Slots in den Story-Reiter der Galerie
 * montiert; sie teilen sich nur diese Atome (dasselbe Muster wie
 * `chatReferencesAtom` zwischen Chat und Quellenspalte).
 */

import { atom } from 'jotai'
import type { StoryTopicsData } from '@ks/contracts'
import { STORY_UEBERSICHT, type AktiveSitzung, type StoryAuswahl } from './types'

/** Was die Mitte zeigt; Start ist die Themenuebersicht. */
export const storyAuswahlAtom = atom<StoryAuswahl>(STORY_UEBERSICHT)

/** Die berechnete Themenuebersicht; `null`, solange keine vorliegt. */
export const storyGliederungAtom = atom<StoryTopicsData | null>(null)

/** Fragen der aktiven Sitzung, live aus dem Chat-Verlauf der App. */
export const storyAktiveSitzungAtom = atom<AktiveSitzung>({ chatId: null, fragen: [] })

/**
 * D11a (Owner 02.10.): „Themenuebersicht neu berechnen" steht als dezenter
 * Knopf in der Chronik an der Zeile „Themenuebersicht", nicht mehr in der
 * Mitte. Die Mitte (StoryRoot) stellt die Aktion hier bereit; `null`, solange
 * keine Gliederung da ist.
 */
export interface UebersichtAktion {
  neuBerechnen: () => void
  laeuft: boolean
}
export const storyUebersichtAktionAtom = atom<UebersichtAktion | null>(null)
