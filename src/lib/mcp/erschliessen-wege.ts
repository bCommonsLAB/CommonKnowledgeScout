/**
 * @fileoverview Die zwei Wege der Audio-Erschliessung sichtbar machen (Welle B).
 *
 * @description
 * Owner 08.10.2026: Beim Analysieren von Audio soll unterscheidbar sein, ob
 * mit Sprecher-Erkennung gearbeitet wird oder ganz ohne — und im zweiten
 * Fall das Transkript danach von Hand geprueft wird (Reiter „Korrektur" der
 * KS-Oberflaeche). Hier wird je Quelle VOR dem Job-Start entschieden und
 * benannt, welcher Weg gilt und woher die Entscheidung kommt (Aufruf,
 * Library-Voreinstellung, Standard), damit nichts still passiert.
 *
 * @module mcp
 */

import { readAudioContextOptions, resolveSpeakerMode, type SpeakerModeSource } from '@/lib/external-jobs/audio-context'
import type { Library } from '@/types/library'

export type ErschliessungsWeg = 'mit_sprechererkennung' | 'ohne_sprechererkennung'

export interface AudioWeg {
  weg: ErschliessungsWeg
  herkunft: 'aufruf' | 'library' | 'standard'
  naechsterSchritt: string
}

export interface AudioEingabe {
  sprecherErkennung?: boolean
  kontext?: string
  begriffe?: string[]
}

const HERKUNFT: Record<SpeakerModeSource, AudioWeg['herkunft']> = { job: 'aufruf', library: 'library', default: 'standard' }

export const NAECHSTER_SCHRITT: Record<ErschliessungsWeg, string> = {
  mit_sprechererkennung:
    'Sprecher-Modell: Transkript mit Sprecher-Labels; Kontext und Begriffe verwirft der Anbieter in diesem Modus. ' +
    'Danach Sprecher-Zuordnung und Namen im Reiter „Korrektur" der KS-Oberflaeche bestaetigen.',
  ohne_sprechererkennung:
    'Standard-Transkription mit Kontext und Begriffen. Danach das Transkript von Hand im Reiter „Korrektur" ' +
    'der KS-Oberflaeche pruefen (Hoerfehler, Namen) — erst dann transformieren.',
}

/** Bruecken-Eingabe → typgepruefte Job-Optionen (dieselbe Pruefung wie die Pipeline-Route). */
export function audioOptionenAusEingabe(eingabe: AudioEingabe): Record<string, unknown> {
  const gelesen = readAudioContextOptions({
    speakerMode: eingabe.sprecherErkennung,
    audioPrompt: eingabe.kontext,
    audioKeywords: eingabe.begriffe,
  })
  if ('error' in gelesen) throw new Error(gelesen.error)
  return gelesen.options
}

/** Welcher Weg fuer eine Audio-Quelle gilt — und woher die Entscheidung kommt. */
export function bestimmeAudioWeg(options: Record<string, unknown>, library: Library): AudioWeg {
  const { speakerMode, speakerModeSource } = resolveSpeakerMode(options, library)
  const weg: ErschliessungsWeg = speakerMode ? 'mit_sprechererkennung' : 'ohne_sprechererkennung'
  return { weg, herkunft: HERKUNFT[speakerModeSource], naechsterSchritt: NAECHSTER_SCHRITT[weg] }
}

/** Zusammenfassung ueber einen Stapel: wie viele Quellen je Weg. */
export function fasseWegeZusammen(wege: ReadonlyArray<AudioWeg | undefined>): Record<ErschliessungsWeg, number> | null {
  const audio = wege.filter((w): w is AudioWeg => w !== undefined)
  if (audio.length === 0) return null
  return {
    mit_sprechererkennung: audio.filter((w) => w.weg === 'mit_sprechererkennung').length,
    ohne_sprechererkennung: audio.filter((w) => w.weg === 'ohne_sprechererkennung').length,
  }
}
