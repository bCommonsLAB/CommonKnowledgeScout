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
