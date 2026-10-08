/**
 * @fileoverview Kontext fuer Audio-Transkriptionen im Datei-Weg (P3a).
 *
 * @description
 * Bis P3a schickte der Datei-Weg nur Datei und Sprachen an den Secretary —
 * Eigennamen und Fachbegriffe wurden deshalb verhoert. Dieses Modul loest
 * fuer einen Audio-Job auf, was an die Transkription geht:
 *
 * - `prompt`    Freitext ueber Thema und Anlass (pro Datei, aus dem Dialog).
 * - `keywords`  Bekannte Namen der Library (`extractionKnownNames`) plus die
 *               Begriffe, die der Anwender fuer diese Datei ergaenzt hat.
 * - `speakerMode` Sprecher-Erkennung: Uebersteuerung pro Datei (Job-Option)
 *               vor der Library-Voreinstellung (`transcriptionSpeakerMode`),
 *               sonst aus. Welche Ebene entschieden hat, steht in
 *               `speakerModeSource` — die Entscheidung ist damit im Job-Trace
 *               nachvollziehbar statt still.
 *
 * Kontext und Sprecher-Erkennung schliessen sich beim Anbieter aus (Plan,
 * Befund 1): Im Sprecher-Modus bleibt der Kontext hier erhalten, damit der
 * Request-Builder ihn SICHTBAR verwirft (Log), nicht stillschweigend.
 *
 * @module external-jobs
 */

import type { ExternalJob } from '@/types/external-job'
import type { Library } from '@/types/library'

/** Job-Optionen, die der Transkriptions-Dialog pro Datei setzt. */
export const AUDIO_CONTEXT_OPTION_KEYS = {
  prompt: 'audioPrompt',
  keywords: 'audioKeywords',
  speakerMode: 'speakerMode',
} as const

export type SpeakerModeSource = 'job' | 'library' | 'default'

/**
 * Kontext-Felder, wie sie ein Client im Request-Body schickt. Beide Wege
 * (Pipeline-Sheet ueber `/api/pipeline/process`, Erfassungs-Wizard ueber
 * `/api/secretary/process-audio/job`) nutzen dieselben Namen.
 */
export interface AudioContextRequestFields {
  /** Thema/Anlass als Freitext fuer die Transkription. */
  audioPrompt?: string
  /** Begriffe fuer diese Datei (zusaetzlich zu `extractionKnownNames` der Library). */
  audioKeywords?: string[]
  /** Sprecher-Erkennung fuer diesen Lauf (uebersteuert die Library-Voreinstellung). */
  speakerMode?: boolean
}

/**
 * Liest die Kontext-Felder typgeprueft aus einem Request-Body und bildet sie
 * auf die Job-Optionen (`AUDIO_CONTEXT_OPTION_KEYS`) ab. Falsche Typen sind
 * ein Client-Fehler (Ergebnis `{ error }`), kein stilles Weglassen. Fehlt ein
 * Feld, bleibt die Option weg — der Server faellt dann sichtbar auf die
 * Library-Voreinstellung zurueck (`speakerModeSource: 'library'`).
 */
export function readAudioContextOptions(
  body: Partial<AudioContextRequestFields>,
): { options: Record<string, unknown> } | { error: string } {
  const options: Record<string, unknown> = {}
  if (body.audioPrompt !== undefined) {
    if (typeof body.audioPrompt !== 'string') return { error: 'audioPrompt muss ein String sein' }
    const prompt = body.audioPrompt.trim()
    if (prompt) options[AUDIO_CONTEXT_OPTION_KEYS.prompt] = prompt
  }
  if (body.audioKeywords !== undefined) {
    if (!Array.isArray(body.audioKeywords) || body.audioKeywords.some((k) => typeof k !== 'string')) {
      return { error: 'audioKeywords muss eine Liste von Strings sein' }
    }
    const keywords = body.audioKeywords.map((k) => k.trim()).filter(Boolean)
    if (keywords.length > 0) options[AUDIO_CONTEXT_OPTION_KEYS.keywords] = keywords
  }
  if (body.speakerMode !== undefined) {
    if (typeof body.speakerMode !== 'boolean') return { error: 'speakerMode muss ein Boolean sein' }
    options[AUDIO_CONTEXT_OPTION_KEYS.speakerMode] = body.speakerMode
  }
  return { options }
}

export interface AudioJobContext {
  /** Thema/Anlass als Freitext; `undefined`, wenn nichts angegeben. */
  prompt: string | undefined
  /** Dedupliziert, in Reihenfolge: Library-Namen, dann Datei-Begriffe. */
  keywords: string[]
  speakerMode: boolean
  speakerModeSource: SpeakerModeSource
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/** Reihenfolge erhalten, Dubletten (auch nur in Gross-/Kleinschreibung) entfernen. */
function dedupeKeywords(entries: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of entries) {
    const key = entry.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}

/**
 * Loest den Kontext eines Audio-Jobs aus Job-Optionen und Library-Config auf.
 * Reine Funktion — keine IO, deshalb in Unit-Tests direkt pruefbar.
 */
export function resolveAudioJobContext(job: ExternalJob, library: Library | undefined): AudioJobContext {
  const opts = (job.correlation?.options ?? {}) as Record<string, unknown>

  const promptRaw = opts[AUDIO_CONTEXT_OPTION_KEYS.prompt]
  const prompt = typeof promptRaw === 'string' && promptRaw.trim().length > 0 ? promptRaw.trim() : undefined

  const libraryNames = readStringList(library?.config?.extractionKnownNames)
  const jobKeywords = readStringList(opts[AUDIO_CONTEXT_OPTION_KEYS.keywords])
  const keywords = dedupeKeywords([...libraryNames, ...jobKeywords])

  return { prompt, keywords, ...resolveSpeakerMode(opts, library) }
}

/**
 * Sprecher-Erkennung: Job-Option vor Library-Voreinstellung vor Standard
 * (aus). Reine Funktion, auch VOR dem Job-Start nutzbar — die Bruecke sagt
 * damit je Quelle, welcher Weg gefahren wird (Welle B).
 */
export function resolveSpeakerMode(
  options: Record<string, unknown> | undefined,
  library: Library | undefined,
): { speakerMode: boolean; speakerModeSource: SpeakerModeSource } {
  const speakerModeRaw = options?.[AUDIO_CONTEXT_OPTION_KEYS.speakerMode]
  if (typeof speakerModeRaw === 'boolean') return { speakerMode: speakerModeRaw, speakerModeSource: 'job' }
  if (typeof library?.config?.transcriptionSpeakerMode === 'boolean') {
    return { speakerMode: library.config.transcriptionSpeakerMode, speakerModeSource: 'library' }
  }
  return { speakerMode: false, speakerModeSource: 'default' }
}
