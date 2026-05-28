/**
 * @fileoverview Stoffgruppen-Klassifikation (Stufe 4) — pure Helfer.
 *
 * @description
 * Vereinfachte Stoffgruppen-Klassifikation: KEINE eigene Persistenz, KEINE
 * `groupClassificationId`. Eine Gruppe wird einmal klassifiziert (ein LLM-Call
 * auf einem repraesentativen Bild via `runDivaTextureFirstPass`) und das
 * Ergebnis (class/type/confidence) wird auf alle Mitglieder ins flache
 * Pass-1-Frontmatter gepatcht. `classification_locked` und
 * `classification_rejected` (Edge-Case #6 / #17) werden dabei NICHT ueber-
 * schrieben — sie sind reine Read-Flags, die der Klassifizierer in der UI
 * setzt und die der Batch hier respektiert.
 *
 * Diese Datei enthaelt nur pure Helfer (keine I/O), damit sich die Logik
 * isoliert testen laesst. Die Orchestrierung (Storage, LLM, MongoDB) sitzt in
 * der API-Route.
 *
 * Quelle: .cursor/plans/diva-texture-liefersystem-integration_e7c2a98f.plan.md
 * (Stufe 4); Abweichung vom Plan: ohne eigene Persistenz, ohne ID.
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { fieldsForSource } from './material-field-sources'

/** Quellbild-Wahl pro Material (aus dem Archiv-Property-Store). */
export type AnalysisSourceImageChoice = 'basecolor' | 'supplier-preview' | null

/**
 * Ein Gruppen-Mitglied, das in der Batch-Klassifikation beruecksichtigt wird.
 * Stammt aus der Galerie-Meta-Projection (vector-repo `kind: 'meta'`).
 */
export interface GroupMember {
  /** Vektor-Doc-Identifier (Material-Markdown-fileId). */
  fileId: string
  /** Bilddatei-Name (z.B. `3_ST_2031_0477_basecolor.jpg`). */
  sourceFileName: string
  /** Aus dem Pass-1-Frontmatter: Override-Schutz fuer Einzelmaterialien. */
  classificationLocked?: boolean
  /** Aus dem Pass-1-Frontmatter: vom Klassifizierer verworfen. */
  classificationRejected?: boolean
  /** Quellbild-Wahl des Klassifizierers (= Archiv-Property `analysisSourceImage`). */
  sourceImageChoice?: AnalysisSourceImageChoice
}

/** Felder, die der Batch ins Mitglieder-Frontmatter schreibt. */
export interface Pass1Classification {
  material_class: string
  material_type: string
  confidence_class: number
  /** Leer-String, wenn kein Typ bestimmt wurde (ceramic/glass/plastic). */
  confidence_type: number | ''
  needs_human_review: boolean
}

/** Begruendung, warum ein Mitglied uebersprungen wurde. */
export type SkipReason = 'locked' | 'rejected'

export interface SkipDecision {
  skip: boolean
  reason?: SkipReason
}

/**
 * Entscheidet, ob ein Mitglied beim Bulk-Apply uebersprungen werden muss.
 * Reihenfolge: `classification_locked` (Edge-Case #6) gewinnt vor
 * `classification_rejected` (Edge-Case #17), damit der Grund stabil ist.
 */
export function shouldSkipMember(member: GroupMember): SkipDecision {
  if (member.classificationLocked === true) return { skip: true, reason: 'locked' }
  if (member.classificationRejected === true) return { skip: true, reason: 'rejected' }
  return { skip: false }
}

/**
 * Waehlt das repraesentative Mitglied einer Gruppe fuer den 1 LLM-Call.
 *
 * Reihenfolge:
 *  1. Erstes Mitglied mit `sourceImageChoice === 'supplier-preview'`, das
 *     weder gelockt noch verworfen ist (Plan Phase C, Schritt 3).
 *  2. Erstes Mitglied, das weder gelockt noch verworfen ist (Fallback).
 *
 * Wirft KEINEN Fehler bei leerer Liste — der Aufrufer entscheidet, wie er das
 * darstellt. Returned `null`, wenn alle Mitglieder gelockt/verworfen sind.
 */
export function pickRepresentative(members: readonly GroupMember[]): GroupMember | null {
  const eligible = members.filter((m) => !shouldSkipMember(m).skip)
  if (eligible.length === 0) return null
  const supplierPreview = eligible.find((m) => m.sourceImageChoice === 'supplier-preview')
  return supplierPreview ?? eligible[0]
}

/** Coerced numerischer Wert oder null (kein stiller 0-Fallback). */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Extrahiert die Pass-1-Klassifikation aus dem Ergebnis-Markdown des
 * repraesentativen Laufs. Liefert `null`, wenn die Pflichtfelder fehlen —
 * dann darf der Bulk-Apply NICHT laufen (kein silent fallback, siehe
 * `no-silent-fallbacks.mdc`).
 */
export function extractClassification(markdown: string): Pass1Classification | null {
  const { meta } = parseFrontmatter(markdown)
  const materialClass = nonEmptyString(meta.material_class)
  const confidenceClass = toNumber(meta.confidence_class)
  if (materialClass === null || confidenceClass === null) return null

  const materialType = typeof meta.material_type === 'string' ? meta.material_type : ''
  const rawConfidenceType = meta.confidence_type
  const confidenceType: number | '' = (() => {
    if (rawConfidenceType === '' || rawConfidenceType === undefined || rawConfidenceType === null) return ''
    const n = toNumber(rawConfidenceType)
    return n ?? 0
  })()

  const needsHumanReview = meta.needs_human_review === true

  return {
    material_class: materialClass,
    material_type: materialType,
    confidence_class: confidenceClass,
    confidence_type: confidenceType,
    needs_human_review: needsHumanReview,
  }
}

/** Optionen fuer das Patchen eines Mitglieds. */
export interface ApplyClassificationOptions {
  /**
   * Wenn `true`, wird `needs_visual_refresh: true` mit ins Frontmatter
   * gepatcht — Signal an Stufe 5, dass die visuellen Properties unter
   * der neuen Klasse neu zu bestimmen sind.
   */
  markVisualRefresh?: boolean
}

/**
 * Patcht die Pass-1-Klassifikation ins Mitglieder-Markdown.
 *
 * Nicht ueberschrieben werden:
 *  - `classification_locked` / `classification_rejected` (Override-Schutz)
 *  - `group_name` (Stoffgruppe ist stabil aus dem Sidecar)
 *  - `availability_scope` / `retailer_iln` (deterministisch aus dem Pfad)
 *
 * Pipeline-Status: `last_pass: 1`, `pass1_status`. Die Hints (`ai_pass_*`)
 * laesst der Batch unveraendert, weil sie pro Material verschieden sein
 * koennen — sie werden erst durch einen vollen Re-Run aktualisiert.
 *
 * Optional setzt der Batch `needs_visual_refresh: true`, wenn sich die
 * `material_class` durch die Propagation aendert (User-Entscheid 2026-05-28:
 * Stufe 5 ist ein Korrektur-Lauf, der auf diesen Marker reagiert).
 *
 * Wirft, wenn das Markdown KEIN Pass-1-Frontmatter enthaelt (kein silent
 * fallback fuer fremde Dokumente).
 */
export function applyClassificationToMember(
  markdown: string,
  classification: Pass1Classification,
  options: ApplyClassificationOptions = {},
): string {
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new Error('applyClassificationToMember: Markdown ist leer')
  }
  const { meta } = parseFrontmatter(markdown)
  if (!meta || typeof meta !== 'object' || Object.keys(meta).length === 0) {
    throw new Error('applyClassificationToMember: Markdown enthaelt kein Frontmatter')
  }

  const updates: Record<string, unknown> = {
    material_class: classification.material_class,
    material_type: classification.material_type,
    confidence_class: classification.confidence_class,
    confidence_type: classification.confidence_type,
    needs_human_review: classification.needs_human_review,
    last_pass: 1,
    pass1_status: classification.needs_human_review ? 'needs_review' : 'done',
  }
  if (options.markVisualRefresh === true) {
    updates.needs_visual_refresh = true
  }
  return patchFrontmatter(markdown, updates)
}

/**
 * Liste der Frontmatter-Keys, die der Batch schreibt — als Single Source of
 * Truth fuer die UI-Anzeige ("Folgende Felder werden uebernommen: …").
 *
 * Bezogen auf die Quellen-Map (`material-field-sources.ts`): genau die
 * Pass-1-Klassifikations-Felder, OHNE die Hints (die werden pro Material erst
 * beim vollen Re-Run neu erzeugt) und OHNE `availability_*` (deterministisch).
 */
export function classificationFieldsApplied(): string[] {
  const pass1 = fieldsForSource('ai_pass1')
  return [...pass1, 'last_pass', 'pass1_status']
}

/**
 * Patch, den der User in der Galerie pro Material setzen darf.
 *
 * `material_class`/`material_type`/`confidence_class`/`confidence_type`/
 * `needs_human_review` sind Klassifikations-Korrekturen — wenn die Klasse
 * oder der Typ sich aendert, setzt `applyMaterialPatch` automatisch
 * `needs_visual_refresh=true` als Signal fuer Stufe 5.
 *
 * `classification_locked` und `classification_rejected` sind reine
 * UI-Flags und haben keinen Effekt auf `needs_visual_refresh`.
 */
export interface MaterialPatch {
  material_class?: string
  material_type?: string
  confidence_class?: number
  confidence_type?: number | ''
  needs_human_review?: boolean
  classification_locked?: boolean
  classification_rejected?: boolean
}

/** Aktueller Stand der Klassifikations-Felder eines Materials. */
export interface MaterialCurrentState {
  material_class: string
  material_type: string
}

export interface ApplyMaterialPatchResult {
  /** Patch-Set, das ins Frontmatter geschrieben werden soll. */
  updates: Record<string, unknown>
  /** True, wenn material_class oder material_type sich aendern → Refresh-Marker. */
  triggersVisualRefresh: boolean
}

/**
 * Bereitet einen Per-Material-Frontmatter-Patch vor und entscheidet
 * deterministisch, ob `needs_visual_refresh=true` mitgeschrieben werden muss.
 *
 * Regeln:
 *  - Wechsel von `material_class` oder `material_type` setzt
 *    `needs_visual_refresh=true` (Stufe-5-Trigger).
 *  - Wechsel der Konfidenz allein loest KEIN Refresh aus.
 *  - `classification_locked`/`_rejected` sind reine Flags, kein Refresh.
 *  - Bei Klassen-Korrektur wird `last_pass=1` + `pass1_status` mitgeschrieben,
 *    damit der Galerie-Snapshot konsistent bleibt.
 *  - `undefined`-Werte im Patch werden ignoriert (kein Loeschen, kein
 *    silent fallback).
 *  - Aenderungen, die mit dem aktuellen Stand identisch sind, werden
 *    nicht erneut markiert (Idempotenz).
 */
export function applyMaterialPatch(
  current: MaterialCurrentState,
  patch: MaterialPatch,
): ApplyMaterialPatchResult {
  const updates: Record<string, unknown> = {}

  // Klassen-/Typ-Korrekturen
  let classChanged = false
  if (typeof patch.material_class === 'string') {
    const next = patch.material_class.trim()
    updates.material_class = next
    if (next !== current.material_class) classChanged = true
  }
  if (typeof patch.material_type === 'string') {
    const next = patch.material_type.trim()
    updates.material_type = next
    if (next !== current.material_type) classChanged = true
  }
  if (typeof patch.confidence_class === 'number') {
    updates.confidence_class = patch.confidence_class
  }
  if (patch.confidence_type !== undefined) {
    updates.confidence_type = patch.confidence_type
  }
  if (typeof patch.needs_human_review === 'boolean') {
    updates.needs_human_review = patch.needs_human_review
  }

  // Reine UI-Flags
  if (typeof patch.classification_locked === 'boolean') {
    updates.classification_locked = patch.classification_locked
  }
  if (typeof patch.classification_rejected === 'boolean') {
    updates.classification_rejected = patch.classification_rejected
  }

  // Bei Klassen-Wechsel: Pipeline-Status + Refresh-Marker mitschreiben
  if (classChanged) {
    updates.last_pass = 1
    updates.pass1_status =
      patch.needs_human_review === true ? 'needs_review' : 'done'
    updates.needs_visual_refresh = true
  }

  return { updates, triggersVisualRefresh: classChanged }
}
