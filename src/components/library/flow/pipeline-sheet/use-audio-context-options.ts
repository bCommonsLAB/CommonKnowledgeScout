"use client"

/**
 * Zustand der Audio-Kontext-Felder (P3a) im Dialog „Aufbereiten & Publizieren":
 * Sprecher erkennen (vorbelegt mit `transcriptionSpeakerMode` der Library),
 * Sprachen der Aufnahme (vorbelegt mit `transcriptionLanguages`),
 * Kontext (Thema, Anlass) und Begriffe (Namen, Fachwoerter) fuer diese Datei.
 *
 * Beim Oeffnen des Sheets werden die Felder zurueckgesetzt; laedt die Library
 * asynchron nach, zieht der Schalter die Voreinstellung nach. Die Werte gehen
 * nur dann in den Start-Request, wenn die Quelle Audio ist UND der Schritt
 * „Transkript erstellen" aktiv ist — sonst bleiben sie weg und der Server
 * entscheidet sichtbar ueber die Library-Voreinstellung.
 */

import * as React from 'react'
import { parseKeywordsText } from '@/components/library/audio-transform-context'
import { parseLanguagesText } from '@/lib/external-jobs/audio-languages'
import type { ClientLibrary } from '@/types/library'

export interface AudioContextStartArgs {
  audioPrompt?: string
  audioKeywords?: string[]
  speakerMode?: boolean
  audioLanguages?: string[]
}

export interface AudioContextOptionsState {
  speakerMode: boolean
  setSpeakerMode: (value: boolean) => void
  prompt: string
  setPrompt: (value: string) => void
  keywordsText: string
  setKeywordsText: (value: string) => void
  /** Sprachcodes als Text („de, it"), vorbelegt aus der Library. */
  languagesText: string
  setLanguagesText: (value: string) => void
  /** Eintraege, die kein Sprachcode sind — der Dialog zeigt sie und sperrt den Start. */
  invalidLanguages: string[]
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
  const librarySpeakerMode = library?.config?.transcriptionSpeakerMode === true
  const knownNamesCount = library?.config?.extractionKnownNames?.length ?? 0
  const libraryLanguagesText = (library?.config?.transcriptionLanguages ?? []).join(', ')

  const [speakerMode, setSpeakerMode] = React.useState<boolean>(librarySpeakerMode)
  const [prompt, setPrompt] = React.useState('')
  const [keywordsText, setKeywordsText] = React.useState('')
  const [languagesText, setLanguagesText] = React.useState(libraryLanguagesText)

  // Beim Oeffnen: Freitexte leeren.
  React.useEffect(() => {
    if (!isOpen) return
    setPrompt('')
    setKeywordsText('')
  }, [isOpen])

  // Beim Oeffnen und sobald die Library (asynchron) da ist: Voreinstellung nachziehen.
  React.useEffect(() => {
    if (!isOpen) return
    setSpeakerMode(librarySpeakerMode)
    setLanguagesText(libraryLanguagesText)
  }, [isOpen, librarySpeakerMode, libraryLanguagesText, library?.id])

  const parsedLanguages = React.useMemo(() => parseLanguagesText(languagesText), [languagesText])

  const toStartArgs = React.useCallback((active: boolean): AudioContextStartArgs => {
    if (!active) return {}
    const trimmedPrompt = prompt.trim()
    const keywords = parseKeywordsText(keywordsText)
    // Ungueltige Codes gehen mit: der Server lehnt sie laut ab (400), statt sie still zu verlieren.
    const languages = [...parsedLanguages.codes, ...parsedLanguages.invalid]
    return {
      speakerMode,
      ...(trimmedPrompt ? { audioPrompt: trimmedPrompt } : {}),
      ...(keywords.length > 0 ? { audioKeywords: keywords } : {}),
      ...(languages.length > 0 ? { audioLanguages: languages } : {}),
    }
  }, [speakerMode, prompt, keywordsText, parsedLanguages])

  return {
    speakerMode,
    setSpeakerMode,
    prompt,
    setPrompt,
    keywordsText,
    setKeywordsText,
    languagesText,
    setLanguagesText,
    invalidLanguages: parsedLanguages.invalid,
    knownNamesCount,
    toStartArgs,
  }
}
