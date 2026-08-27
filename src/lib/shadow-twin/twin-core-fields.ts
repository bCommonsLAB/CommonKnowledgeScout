/**
 * Twin-Kern-Feldsatz — der Frontmatter-Kern ERZEUGTER Twin-Artefakte
 * (Transkript/Transformation), definiert im Twin-Datei-Contract
 * (`docs/concepts/twin-datei-contract.md`, §2b/§3).
 *
 * BEWUSST GETRENNT vom A0-Basis-Feld-Contract
 * (`src/lib/detail-view-types/base-fields.ts`): Der A0-Kern gilt fuer jedes
 * Dokument jeder Library und wird von Template-Gates und Library-Verifikation
 * erzwungen; der Twin-Kern gilt nur fuer erzeugte Twin-Dateien und wird am
 * Schreib-Engpass gestempelt (`twin-core-stamp.ts`) bzw. spaeter von der
 * Agentensicht als Befund geprueft. `BASE_REQUIRED_FIELDS` bleibt unveraendert.
 *
 * Frontmatter-Format: flach, snake_case, Obsidian-kompatibel (AGENTS.md).
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'

/** Strukturfelder des Twin-Kerns (Reihenfolge = Contract §3.1). */
export const TWIN_CORE_FIELDS = [
  'type',
  'source_file',
  'template',
  'language',
  'generated_by',
  'generated_at',
] as const

export type TwinCoreField = (typeof TWIN_CORE_FIELDS)[number]

/** Kurations-Felder (Contract §3.2) — gepflegt von der Verifikation, nie vom Generator. */
export const TWIN_CURATION_FIELDS = [
  'twin_status',
  'verified_by',
  'verified_at',
  // ADR 0006: Herkunft der Fehler-Markierung — Muster wie verified_by/_at.
  'flagged_by',
  'flagged_at',
  'flagged_note',
] as const

export type TwinCurationField = (typeof TWIN_CURATION_FIELDS)[number]

/** Erlaubte Werte fuer `twin_status` (Const-Array statt Enum, siehe .cursorrules). */
/**
 * `flagged` = ein Mensch hat das Artefakt als fehlerhaft markiert (ADR 0006,
 * Modell B). Der Wert sperrt die Abnahme, bis die Markierung aufgeloest ist;
 * die Herkunft steht in `flagged_by`/`flagged_at`/`flagged_note`.
 */
export const TWIN_STATUS_VALUES = ['draft', 'stable', 'deprecated', 'flagged'] as const

export type TwinStatus = (typeof TWIN_STATUS_VALUES)[number]

/**
 * Pflicht-Kernfelder je Artefakt-Art (Contract §3.1):
 * - `source_file` nur fuer quellgebundene Twins,
 * - `template` PFLICHT bei Transformation (sonst verboten — erzwingt der Stempel),
 * - `language` bei der Transformation die Zielsprache; beim Transkript ist die
 *   Inhaltssprache dem Writer nicht sicher bekannt → dort kein Pflichtfeld
 *   (kein geratener Wert, `no-silent-fallbacks`).
 * `canonical`/`raw` sind interne Artefakte ohne Kern-Pflicht (Contract §2).
 */
const REQUIRED_BY_KIND: ReadonlyMap<ArtifactKind, readonly TwinCoreField[]> = new Map([
  ['transcript', ['type', 'source_file', 'generated_by', 'generated_at']],
  ['transformation', ['type', 'source_file', 'template', 'language', 'generated_by', 'generated_at']],
  ['canonical', []],
  ['raw', []],
])

/** Pflicht-Kernfelder fuer die gegebene Artefakt-Art. */
export function requiredTwinCoreFields(kind: ArtifactKind): readonly TwinCoreField[] {
  return REQUIRED_BY_KIND.get(kind) ?? []
}

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/**
 * Liefert die Kern-Pflichtfelder, die im Frontmatter FEHLEN — exakte Pruefung,
 * keine stillen Aliasse; leere Strings zaehlen als fehlend.
 * Reihenfolge wie `TWIN_CORE_FIELDS`.
 */
export function missingTwinCoreFields(
  meta: Record<string, unknown>,
  kind: ArtifactKind,
): TwinCoreField[] {
  return requiredTwinCoreFields(kind).filter((field) => isMissingValue(meta[field]))
}

/**
 * Actor-Ebene einer OKF-Actor-Angabe (Contract §3.1):
 * `knowledgescout/gemini-2.5-pro` → `knowledgescout`, `human:peter` →
 * `human:peter`. Die Invariante „niemand verifiziert die eigene Generierung"
 * (Contract §3.2) gilt auf DIESER Ebene.
 */
export function actorLevel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  return trimmed.split('/')[0].trim().toLowerCase()
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parst einen Kern-Zeitstempel (ISO-Datum oder ISO-Datetime) zu Millisekunden.
 * Reine Datumsangaben ("2026-08-18") tragen keine Uhrzeit; der Aufrufer sagt
 * explizit, ob sie als Tagesanfang oder Tagesende gelesen werden — die
 * temporale Regel liest grosszuegig in beide Richtungen (siehe
 * `isVerificationValid`). Unlesbare Werte → null (kein stiller Default).
 */
export function parseTwinCoreTimestamp(
  value: unknown,
  dateOnlyBoundary: 'day-start' | 'day-end',
): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }
  if (typeof value !== 'string' || value.trim() === '') return null
  const raw = value.trim()
  const iso = DATE_ONLY_RE.test(raw)
    ? `${raw}${dateOnlyBoundary === 'day-end' ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`
    : raw
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Temporale Gueltigkeitsregel (Contract §3.2): Eine Verifikation zaehlt nur,
 * wenn `verified_at >= generated_at`.
 *
 * - Fehlendes/unlesbares `verified_at` → false (unverifiziert).
 * - Fehlendes `generated_at` → true: Legacy-Twins ohne Writer-Stempel werden
 *   nicht abgewertet; das fehlende Feld meldet separat `missingTwinCoreFields`.
 * - Reine Datumsangaben werden grosszuegig gelesen (generated: Tagesanfang,
 *   verified: Tagesende), damit eine Hand-Verifikation am selben Tag zaehlt.
 */
export function isVerificationValid(args: { generatedAt: unknown; verifiedAt: unknown }): boolean {
  const verifiedMs = parseTwinCoreTimestamp(args.verifiedAt, 'day-end')
  if (verifiedMs === null) return false
  const generatedMs = parseTwinCoreTimestamp(args.generatedAt, 'day-start')
  if (generatedMs === null) return true
  return verifiedMs >= generatedMs
}

/** Kandidat fuer die Wahl des fuehrenden Artefakts (Teilmenge des ArtifactKey). */
export interface LeadingArtifactCandidate {
  kind: ArtifactKind
  templateName?: string
}

/**
 * Fuehrendes Artefakt einer Twin-Familie (Contract §2b): die Transformation
 * nach dem Standard-Template der Library; fehlt sie — oder ist kein
 * Standard-Template konfiguriert —, fuehrt das Transkript. Sprachauswahl ist
 * Sache des Aufrufers (Kandidaten vorfiltern); bei mehreren Treffern zaehlt
 * der erste in der gegebenen Reihenfolge.
 */
export function selectLeadingArtifact<T extends LeadingArtifactCandidate>(
  candidates: readonly T[],
  standardTemplate: string | null | undefined,
): T | null {
  if (typeof standardTemplate === 'string' && standardTemplate.trim() !== '') {
    const transformation = candidates.find(
      (candidate) => candidate.kind === 'transformation' && candidate.templateName === standardTemplate,
    )
    if (transformation) return transformation
  }
  return candidates.find((candidate) => candidate.kind === 'transcript') ?? null
}
