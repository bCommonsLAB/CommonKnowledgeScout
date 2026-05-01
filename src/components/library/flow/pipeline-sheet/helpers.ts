/**
 * flow/pipeline-sheet/helpers.ts
 *
 * Helper + Konstanten + Types fuer PipelineSheet.
 *
 * Aus `flow/pipeline-sheet.tsx` ausgegliedert
 * (Welle 3-II-d, Schritt 5/7).
 */

import { TARGET_LANGUAGE_VALUES, TARGET_LANGUAGE_LABELS, type TargetLanguage } from '@/lib/chat/constants'
import { type PipelinePolicies as PipelinePoliciesType } from '@/lib/pipeline/pipeline-config'

// Re-Export fuer Rueckwaertskompatibilitaet (Konsumenten importieren
// PipelinePolicies weiter aus pipeline-sheet).
export type PipelinePolicies = PipelinePoliciesType

/** Cover-Image-Optionen fuer den Pipeline-Start. */
export interface CoverImageOptions {
  /** Cover-Bild automatisch generieren */
  generateCoverImage: boolean
  /** Optionaler Prompt (ueberschreibt Library-Default) */
  coverImagePrompt?: string
}

/**
 * Informationen ueber bereits vorhandene Artefakte.
 * Ermoeglicht intelligente Vorauswahl und Abhaengigkeits-Logik.
 */
export interface ExistingArtifacts {
  /** Transcript/Extraktion ist vorhanden */
  hasTranscript: boolean
  /** Transformierte Version ist vorhanden */
  hasTransformed: boolean
  /** Bereits indexiert/ingested */
  hasIngested: boolean
}

/** LLM-Modell fuer Dropdown-Auswahl. */
export interface LlmModelOption {
  /** Modell-ID (z.B. 'google/gemini-2.5-flash') */
  modelId: string
  /** Anzeigename (z.B. 'Gemini 2.5 Flash') */
  name: string
  /** Beschreibung der Staerken */
  strengths?: string
}

/**
 * Zusaetzliche Whisper-Sprachen, die nicht in TARGET_LANGUAGE_LABELS stehen.
 * Werden an die zentrale Sprachliste angehaengt.
 */
const EXTRA_WHISPER_LANGUAGES: Record<string, string> = {
  ar: 'Arabisch',
  am: 'Amharisch',
}

/**
 * Quellsprachen fuer die Transkription (Whisper).
 * Abgeleitet aus den zentralen TARGET_LANGUAGE_LABELS + Whisper-spezifische Extras.
 * 'auto' = automatische Erkennung durch Whisper.
 */
export const TRANSCRIPTION_SOURCE_LANGUAGES: readonly { value: string; label: string }[] = [
  { value: 'auto', label: 'Automatisch erkennen' },
  // Zentrale Sprachen (ohne 'global') + Whisper-Extras
  ...TARGET_LANGUAGE_VALUES
    .filter((v): v is Exclude<TargetLanguage, 'global'> => v !== 'global')
    .map(v => ({ value: v, label: TARGET_LANGUAGE_LABELS[v] })),
  ...Object.entries(EXTRA_WHISPER_LANGUAGES)
    .filter(([code]) => !(code in TARGET_LANGUAGE_LABELS))
    .map(([code, label]) => ({ value: code, label })),
]

/**
 * Zielsprachen fuer die Transformation.
 * Abgeleitet aus den zentralen TARGET_LANGUAGE_LABELS (ohne 'global').
 */
export const TRANSFORMATION_TARGET_LANGUAGES: readonly { value: string; label: string }[] =
  TARGET_LANGUAGE_VALUES
    .filter((v): v is Exclude<TargetLanguage, 'global'> => v !== 'global')
    .map(v => ({ value: v, label: TARGET_LANGUAGE_LABELS[v] }))

/** Type-Guard: ist Wert ein nicht-leerer String (nach Trim)? */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}
