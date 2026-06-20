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

// =============================================================================
// PIPELINE-PLAN: Force gilt ab Einstiegspunkt ABWAERTS, nie aufwaerts.
// =============================================================================

/** Die drei Pipeline-Phasen in fester Reihenfolge. */
export type PipelinePhase = 'transcript' | 'transform' | 'story'

/**
 * Rang der Phasen. Bestimmt "vorgelagert" (kleiner) vs. "nachgelagert" (groesser).
 * transcript(0) -> transform(1) -> story(2).
 */
export const PHASE_RANK: Record<PipelinePhase, number> = {
  transcript: 0,
  transform: 1,
  story: 2,
}

/** Was mit einer Phase beim Start passiert (fuer den Bestaetigungsdialog). */
export type PipelinePlanAction = 'create' | 'overwrite' | 'reuse'

/** Eine Zeile im Bestaetigungsdialog (eine pro relevanter Phase). */
export interface PipelinePlanLine {
  phase: PipelinePhase
  action: PipelinePlanAction
}

/** Eingabe fuer {@link buildPipelinePlan}. */
export interface PipelinePlanInput {
  /** Markdown/Bild: keine Transkript-Phase. */
  skipExtract: boolean
  /** Rang des Einstiegspunkts (woher der Job gestartet wurde). */
  entryRank: number
  /** Welche Phasen aktuell aktiviert sind. */
  enabled: { extract: boolean; transform: boolean; ingest: boolean }
  /** Welche Artefakte bereits existieren. */
  existing: ExistingArtifacts
  /** Ueberschreiben-Modus aktiv (Force). */
  force: boolean
}

/** Ergebnis von {@link buildPipelinePlan}. */
export interface PipelinePlanResult {
  /** Policies fuer die Pipeline-API. */
  policies: PipelinePolicies
  /** Klartext-Zeilen fuer den Bestaetigungsdialog. */
  lines: PipelinePlanLine[]
  /** True, wenn mindestens ein bestehendes Artefakt ueberschrieben wird. */
  hasOverwrite: boolean
}

/**
 * Leitet aus Aktivierung, Einstiegspunkt und vorhandenen Artefakten die
 * Pipeline-Policies UND eine menschenlesbare Zusammenfassung ab.
 *
 * Kernregel: `force` setzt eine Phase nur dann auf 'force', wenn die Phase
 * AKTIV ist, ihr Rang >= Einstiegspunkt-Rang ist (also nicht vorgelagert) UND
 * das Artefakt bereits existiert. Vorgelagerte Schritte werden so NIE neu
 * berechnet (z.B. kein erneutes OCR-Transkript, wenn man nur transformiert).
 */
export function buildPipelinePlan(input: PipelinePlanInput): PipelinePlanResult {
  // Directive einer einzelnen Phase bestimmen.
  const directive = (enabled: boolean, rank: number, exists: boolean): 'ignore' | 'do' | 'force' => {
    if (!enabled) return 'ignore'
    // Force nur ab Einstiegspunkt abwaerts und nur wenn etwas zu ueberschreiben ist.
    if (input.force && rank >= input.entryRank && exists) return 'force'
    return 'do'
  }

  const policies: PipelinePolicies = {
    extract: input.skipExtract
      ? 'ignore'
      : directive(input.enabled.extract, PHASE_RANK.transcript, input.existing.hasTranscript),
    metadata: directive(input.enabled.transform, PHASE_RANK.transform, input.existing.hasTransformed),
    ingest: directive(input.enabled.ingest, PHASE_RANK.story, input.existing.hasIngested),
  }

  // Klartext-Zeile aus Policy + Existenz ableiten (konsistent mit Gate-Verhalten).
  const lineAction = (policy: 'ignore' | 'do' | 'force', exists: boolean): PipelinePlanAction | null => {
    if (policy === 'force') return 'overwrite'
    // 'do' respektiert das Gate: existiert das Artefakt, wird es wiederverwendet.
    if (policy === 'do') return exists ? 'reuse' : 'create'
    // 'ignore': nur als wiederverwendet anzeigen, wenn es existiert.
    return exists ? 'reuse' : null
  }

  const lines: PipelinePlanLine[] = []
  if (!input.skipExtract) {
    const a = lineAction(policies.extract, input.existing.hasTranscript)
    if (a) lines.push({ phase: 'transcript', action: a })
  }
  const at = lineAction(policies.metadata, input.existing.hasTransformed)
  if (at) lines.push({ phase: 'transform', action: at })
  const ai = lineAction(policies.ingest, input.existing.hasIngested)
  if (ai) lines.push({ phase: 'story', action: ai })

  const hasOverwrite = lines.some(l => l.action === 'overwrite')
  return { policies, lines, hasOverwrite }
}
