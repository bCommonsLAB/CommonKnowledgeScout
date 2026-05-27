/**
 * @fileoverview Deterministische Nachbearbeitung des 1. LLM-Passes (Stufe 3).
 *
 * @description
 * Nimmt die rohe LLM-Antwort (geparste Frontmatter-Felder) und erzeugt das
 * FLACHE Pass-1-Frontmatter gemaess Lea-Regeln + Stolperfallen:
 *  - Felder kommen aus `llmFieldsForPass(1)` (keine harte Duplizierung).
 *  - Sidecar-Class-Treffer ueberschreibt material_class deterministisch und
 *    setzt confidence_class = 0.95 (Stolperfalle #2, Lea-Regel #2). Reine
 *    Bildklassifikation wird bei 0.8 gekappt.
 *  - ceramic/glass/plastic erhalten KEINEN material_type.
 *  - availability_scope/retailer_iln deterministisch aus dem Pfad.
 *  - Pass-2-Felder bleiben explizit leer; last_pass=1 + pass1_status werden
 *    pipeline-seitig gesetzt (nicht vom LLM).
 *
 * Rein deterministisch, KEIN LLM-Call, KEINE Seiteneffekte. Idempotent:
 * gleiche Eingaben → gleiches Ergebnis.
 */

import type { OptionvalueEntry } from './types'
import { mapMaterialClass } from './material-class-mapping'
import { fieldsForSource } from './material-field-sources'
import { parseAvailabilityFromPath } from './availability-from-path'

/** Konfidenz-Wert fuer einen Liefersystem-Class-Treffer (deterministisch). */
const SIDECAR_CLASS_CONFIDENCE = 0.95
/** Obergrenze fuer reine Bildklassifikation ohne Liefersystem-Treffer. */
const IMAGE_ONLY_CONFIDENCE_CAP = 0.8

/** Klassen, fuer die KEIN material_type bestimmt wird (nur Klasse). */
const CLASSES_WITHOUT_TYPE = new Set(['ceramic', 'glass', 'plastic'])

export type Pass1Status = 'done' | 'needs_review'

export interface BuildFirstPassArgs {
  /** Geparste Frontmatter-Felder aus der LLM-Antwort. */
  llmFields: Record<string, unknown>
  /** Gematchter Sidecar-Eintrag oder null (kein Treffer). */
  supplierEntry: OptionvalueEntry | null
  /** Voller Verzeichnispfad der Textur (fuer availability/retailer_iln). */
  filePath: string
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

/** Coerced Boolean (akzeptiert echte Booleans und "true"/"false"-Strings). */
function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return null
}

/** Clamped einen Wert auf [0, max]. */
function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max)
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Erzeugt das flache Pass-1-Frontmatter-Objekt (zum Patchen ins Markdown).
 */
export function buildFirstPassFrontmatter(args: BuildFirstPassArgs): Record<string, unknown> {
  const { llmFields, supplierEntry, filePath } = args
  const mapping = mapMaterialClass(supplierEntry?.Material)
  const sidecarClassHit = supplierEntry !== null && mapping.isKnown && mapping.materialClass !== null

  // --- material_class: Sidecar-Treffer gewinnt, sonst LLM ---
  const llmClass = nonEmptyString(llmFields.material_class)
  const materialClass = sidecarClassHit ? mapping.materialClass : llmClass

  // --- material_type: leer fuer ceramic/glass/plastic; Mapping-Typ gewinnt ---
  const classWithoutType = materialClass !== null && CLASSES_WITHOUT_TYPE.has(materialClass)
  let materialType = ''
  if (!classWithoutType) {
    materialType = mapping.materialType ?? nonEmptyString(llmFields.material_type) ?? ''
  }

  // --- confidence_class: Sidecar deterministisch 0.95, sonst LLM gekappt ---
  let confidenceClass: number
  let forceReview = false
  if (sidecarClassHit) {
    confidenceClass = SIDECAR_CLASS_CONFIDENCE
  } else {
    const llmConf = toNumber(llmFields.confidence_class)
    if (llmConf === null) {
      confidenceClass = 0
      forceReview = true
    } else {
      confidenceClass = clamp(llmConf, IMAGE_ONLY_CONFIDENCE_CAP)
    }
  }

  // --- confidence_type: leer ohne Typ, sonst LLM-Wert geclamped ---
  let confidenceType: number | '' = ''
  if (!classWithoutType && materialType !== '') {
    const llmTypeConf = toNumber(llmFields.confidence_type)
    confidenceType = llmTypeConf === null ? 0 : clamp(llmTypeConf, 1)
  }

  // --- needs_human_review ---
  const llmReview = toBoolean(llmFields.needs_human_review)
  const needsHumanReview = forceReview || materialClass === null || llmReview === true

  // --- availability deterministisch aus dem Pfad ---
  const { availability_scope, retailer_iln } = parseAvailabilityFromPath(filePath)

  const result: Record<string, unknown> = {
    // ai_pass1-Felder (feldspezifische Kalibrierung, daher explizit)
    material_class: materialClass ?? '',
    material_type: materialType,
    confidence_class: confidenceClass,
    confidence_type: confidenceType,
    needs_human_review: needsHumanReview,
    // deterministisch aus dem Pfad
    availability_scope,
    retailer_iln,
    // Pipeline-/System-verwaltet (nicht vom LLM)
    last_pass: 1,
    pass1_status: needsHumanReview ? ('needs_review' satisfies Pass1Status) : ('done' satisfies Pass1Status),
  }

  // aiGenerationHints (ai_last_pass) unveraendert uebernehmen — Feldliste aus
  // der Quellen-Map ziehen (keine harte Duplizierung).
  for (const field of fieldsForSource('ai_last_pass')) {
    result[field] = llmFields[field] ?? ''
  }

  // Pass-2-Felder explizit leer halten (werden erst in Stufe 5 gefuellt).
  for (const field of fieldsForSource('ai_pass2')) {
    if (!(field in result)) result[field] = ''
  }

  return result
}
