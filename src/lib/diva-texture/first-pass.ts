/**
 * @fileoverview Deterministische Nachbearbeitung des Voll-Pass-1-Laufes (Stufe 3).
 *
 * @description
 * Sidecar-Treffer ueberschreibt material_class + confidence_class=0.95;
 * LLM-only-Klassifikation wird bei 0.8 gekappt. ceramic/glass/plastic ohne
 * material_type. Visuelle Properties + Hints 1:1 aus der LLM-Antwort
 * (Voll-Pass-Modell, User-Entscheid 2026-05-28). Update 2 (Lea-Regeln #11/#12):
 * color_match_supplier/_notes + review_status via `review-status.ts` mit
 * Override-Schutz fuer manuelle Stati. Rein deterministisch, idempotent.
 */

import type { AnalysisSourceImage, OptionvalueEntry } from './types'
import { mapMaterialClass } from './material-class-mapping'
import { fieldsForSource } from './material-field-sources'
import { parseAvailabilityFromPath } from './availability-from-path'
import {
  applyReviewStatusOverrideGuard,
  buildColorMatchOutcome,
  type ReviewStatus,
} from './review-status'

export type { ReviewStatus } from './review-status'

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
  /**
   * Welches Quellbild tatsaechlich ans LLM ging. Snapshot ins Frontmatter
   * (`analysisSourceImage`) — Default `basecolor`. Update 2: Pass 1 sendet
   * IMMER beide Bilder, der Snapshot bleibt aus Historie-Gruenden.
   */
  sourceImage?: AnalysisSourceImage
  /**
   * Update 2: true, wenn der Lauf tatsaechlich eine Supplier-Preview ans LLM
   * gesendet hat. Steuert den Color-Match-Postprocessor (Edge-Case #21).
   * Default `false`.
   */
  supplierPreviewSent?: boolean
  /**
   * Update 2: bisheriger `review_status` aus dem Frontmatter. Steuert den
   * Override-Schutz (Stolperfalle #16). Default `nicht_geprueft`.
   */
  existingReviewStatus?: ReviewStatus
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

  // --- group_name (Stoffgruppe) deterministisch aus dem Sidecar-Treffer ---
  // Ermoeglicht die Galerie-Gruppierung nach Stoffgruppe (Stufe 4). Leer ohne Treffer.
  const groupName = nonEmptyString(supplierEntry?.GroupName) ?? ''

  // Update 2 (2026-05-28): Color-Match-Postprocessor + Review-Status mit
  // Override-Schutz. Beides muss VOR dem Frontmatter-Dictionary stehen, damit
  // wir die Felder zentral setzen und der ai_pass1-Loop sie ueberspringt.
  const supplierPreviewSent = args.supplierPreviewSent ?? false
  const existingReviewStatus: ReviewStatus = args.existingReviewStatus ?? 'nicht_geprueft'
  const colorMatch = buildColorMatchOutcome(llmFields, supplierPreviewSent)
  const reviewStatus = applyReviewStatusOverrideGuard(existingReviewStatus, colorMatch.proposedReviewStatus)

  const result: Record<string, unknown> = {
    // ai_pass1-Felder (feldspezifische Kalibrierung, daher explizit)
    material_class: materialClass ?? '',
    material_type: materialType,
    confidence_class: confidenceClass,
    confidence_type: confidenceType,
    needs_human_review: needsHumanReview,
    // Update 2: Color-Match-Felder (ai_pass1, deterministisch korrigiert).
    // Hinweis: `null` wird vom Frontmatter-Composer geschluckt — Abwesenheit
    // im Frontmatter hat dieselbe Semantik wie explizites `null` ("kein
    // Vergleich gelaufen"). Stufe-4-UI behandelt beides identisch.
    color_match_supplier: colorMatch.colorMatchSupplier,
    color_match_notes: colorMatch.colorMatchNotes,
    // deterministisch aus dem Pfad / Sidecar
    availability_scope,
    retailer_iln,
    group_name: groupName,
    // Pipeline-/System-verwaltet (nicht vom LLM)
    last_pass: 1,
    pass1_status: needsHumanReview ? ('needs_review' satisfies Pass1Status) : ('done' satisfies Pass1Status),
    // Update 2: Lebenszyklus-Status mit Override-Schutz
    review_status: reviewStatus,
    // Snapshot des LETZTEN Lauf-Quellbilds (Stufe 3+). User-Praeferenz im
    // Archiv-Property-Store kann sich danach aendern; das hier bleibt
    // der historische Wahrheits-Anker fuer dieses Analyse-Ergebnis.
    analysisSourceImage: args.sourceImage ?? 'basecolor',
  }

  // Visuelle Properties (ai_pass2-Felder) + Hints (ai_last_pass) werden seit
  // dem Voll-Pass-Modell (User-Entscheid 2026-05-28) unveraendert aus der
  // LLM-Antwort uebernommen — kein expliziter Leer-Loop mehr.
  for (const field of [...fieldsForSource('ai_pass2'), ...fieldsForSource('ai_last_pass')]) {
    // confidence_class/_type sind ai_pass1 und schon oben kalibriert behandelt.
    if (field in result) continue
    const raw = llmFields[field]
    if (raw === undefined || raw === null) {
      result[field] = ''
    } else {
      result[field] = raw
    }
  }

  return result
}
