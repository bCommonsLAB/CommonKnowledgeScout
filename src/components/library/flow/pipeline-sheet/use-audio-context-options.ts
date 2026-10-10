"use client"

/**
 * Zustand der Audio-Kontext-Felder im Dialog „Aufbereiten & Publizieren":
 * Sprachen der Aufnahme (vorbelegt mit `transcriptionLanguages` der Library),
 * Kontext (Thema, Anlass) und Begriffe (Namen, Fachwoerter) fuer diese Datei.
 *
 * Sprachen → Start-Argumente: keine = automatisch erkennen; eine = feste
 * Quellsprache; mehrere = gemischte Aufnahme (`audioLanguages`, Quellsprache
 * automatisch). Der Sprecher-Modus wird nicht mehr angeboten (Owner
 * 10.10.2026) und deshalb ausdruecklich als `false` gesendet.
 *
 * Beim Oeffnen des Sheets werden die Felder zurueckgesetzt; laedt die Library
 * asynchron nach, ziehen die Sprachen die Voreinstellung nach. Die Werte gehen
 * nur dann in den Start-Request, wenn die Quelle Audio ist UND der Schritt
 * „Transkript erstellen" aktiv ist.
 */

import * as React from 'react'
import { parseKeywordsText } from '@/components/library/audio-transform-context'
import { readLanguageList } from '@/lib/external-jobs/audio-languages'
import type { ClientLibrary } from '@/types/library'

export interface AudioContextStartArgs {
  audioPrompt?: string
  audioKeywords?: string[]
  speakerMode?: boolean
  audioLanguages?: string[]
  /** Eine gewaehlte Sprache wird zur Quellsprache; sonst automatisch. */
  sourceLanguage?: string
}

export interface AudioContextOptionsState {
  sprachen: string[]
  setSprachen: (codes: string[]) => void
  prompt: string
  setPrompt: (value: string) => void
  keywordsText: string
  setKeywordsText: (value: string) => void
  /** Anzahl der `extractionKnownNames` der Library (Hinweistext im Dialog). */
  knownNamesCount: number
  /**
   * Start-Argumente fuer `onStart`. `active=false` liefert ein leeres Objekt,
   * damit kein Wert fuer Nicht-Audio-Quellen oder ohne Transkript-Schritt mitgeht.
   */
  toStartArgs: (active: boolean) => AudioContextStartArgs
}

export function useAudioContextOptions(args: {
  library: ClientLibrary | null | undefined
  isOpen: boolean
}): AudioContextOptionsState {
  const { library, isOpen } = args
  const knownNamesCount = library?.config?.extractionKnownNames?.length ?? 0
  const librarySprachenKey = readLanguageList(library?.config?.transcriptionLanguages).codes.join(',')

  const [sprachen, setSprachen] = React.useState<string[]>(librarySprachenKey ? librarySprachenKey.split(',') : [])
  const [prompt, setPrompt] = React.useState('')
  const [keywordsText, setKeywordsText] = React.useState('')

  // Beim Oeffnen: Freitexte leeren.
  React.useEffect(() => {
    if (!isOpen) return
    setPrompt('')
    setKeywordsText('')
  }, [isOpen])

  // Beim Oeffnen und sobald die Library (asynchron) da ist: Voreinstellung nachziehen.
  React.useEffect(() => {
    if (!isOpen) return
    setSprachen(librarySprachenKey ? librarySprachenKey.split(',') : [])
  }, [isOpen, librarySprachenKey, library?.id])

  const toStartArgs = React.useCallback((active: boolean): AudioContextStartArgs => {
    if (!active) return {}
    const trimmedPrompt = prompt.trim()
    const keywords = parseKeywordsText(keywordsText)
    return {
      speakerMode: false,
      // Schluessel immer setzen: ueberschreibt eine evtl. veraltete Quellsprache des Dialogs (undefined = automatisch).
      sourceLanguage: sprachen.length === 1 ? sprachen[0] : undefined,
      ...(sprachen.length > 0 ? { audioLanguages: sprachen } : {}),
      ...(trimmedPrompt ? { audioPrompt: trimmedPrompt } : {}),
      ...(keywords.length > 0 ? { audioKeywords: keywords } : {}),
    }
  }, [sprachen, prompt, keywordsText])

  return { sprachen, setSprachen, prompt, setPrompt, keywordsText, setKeywordsText, knownNamesCount, toStartArgs }
}
