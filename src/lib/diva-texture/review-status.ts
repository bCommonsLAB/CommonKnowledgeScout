/**
 * @fileoverview Review-Status-Lifecycle + Color-Match-Postprocessor
 * (Stufe 3, Update 2 2026-05-28, Lea-Regeln #11/#12).
 *
 * @description
 * Pure Helfer fuer die Pass-1-Nachbearbeitung — getrennt von `first-pass.ts`,
 * damit dort die Class-/Type-Kalibrierung uebersichtlich bleibt.
 *
 * Zustaendig fuer:
 *  - Normalisierung der LLM-Antwort fuer `color_match_supplier` /
 *    `color_match_notes` (Edge-Cases #21 + #22).
 *  - Override-Schutz beim `review_status` (Stolperfalle #16):
 *    `abgenommen` und manuell gesetztes `zu_ueberarbeiten` werden vom
 *    Pass-1-Lauf NICHT ueberschrieben.
 *
 * Rein deterministisch, KEIN LLM-Call, KEINE Seiteneffekte.
 */

/**
 * Lebenszyklus-Status eines Materials (Lea-Regel #12).
 *
 * - `nicht_geprueft` (initial, vor dem ersten Lauf)
 * - `ki_geprueft` (Pass 1 OK, keine Farb-Abweichung erkannt)
 * - `zu_ueberarbeiten` (Color-Mismatch oder vom Klassifizierer markiert)
 * - `abgenommen` (vom Klassifizierer bestaetigt)
 */
export type ReviewStatus =
  | 'nicht_geprueft'
  | 'ki_geprueft'
  | 'zu_ueberarbeiten'
  | 'abgenommen'

/** Stati, die der Pass-1-Postprocessor ueberschreiben darf. */
const PASS1_OVERRIDABLE_STATI: ReadonlySet<ReviewStatus> = new Set<ReviewStatus>([
  'nicht_geprueft',
  'ki_geprueft',
])

/**
 * Ergebnis des Color-Match-Postprocessors. Triple aus den drei betroffenen
 * Frontmatter-Feldern.
 */
export interface ColorMatchOutcome {
  /** boolean | null — null wenn keine Supplier-Preview ans LLM ging. */
  colorMatchSupplier: boolean | null
  /** Pflicht-Begruendung bei Mismatch (leer sonst). */
  colorMatchNotes: string
  /**
   * Vorlaeufiger Lifecycle-Status, den Pass 1 setzen WUERDE:
   *  - `zu_ueberarbeiten` bei `colorMatchSupplier === false`.
   *  - `ki_geprueft` sonst (kein Mismatch erkennbar).
   * Der finale Wert beruecksichtigt zusaetzlich den Override-Schutz.
   */
  proposedReviewStatus: 'ki_geprueft' | 'zu_ueberarbeiten'
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

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Normalisiert die LLM-Antwort fuer color_match_supplier/_notes und leitet
 * den vorlaeufigen `review_status` ab. Behandelt:
 *  - Edge-Case #21: keine Supplier-Preview gesendet → match = null,
 *    notes leer, status = ki_geprueft.
 *  - Edge-Case #22: LLM antwortet match=true mit gefuellten notes → notes
 *    werden geleert (Inkonsistenz-Korrektur).
 *  - LLM antwortet match=false mit fehlenden notes → notes bleibt leer, der
 *    Mismatch wird trotzdem als zu_ueberarbeiten markiert (die UI in
 *    Stufe 4 zeigt den Status; fehlt der Klassifizierer eine Begruendung,
 *    nutzt er das Status-Reset-Action).
 *  - LLM-Antwort fehlt / ist ungueltig → match = null (kein false-positive
 *    Mismatch).
 */
export function buildColorMatchOutcome(
  llmFields: Record<string, unknown>,
  supplierPreviewSent: boolean,
): ColorMatchOutcome {
  if (!supplierPreviewSent) {
    return {
      colorMatchSupplier: null,
      colorMatchNotes: '',
      proposedReviewStatus: 'ki_geprueft',
    }
  }

  const llmMatch = toBoolean(llmFields.color_match_supplier)
  const llmNotes = nonEmptyString(llmFields.color_match_notes)

  if (llmMatch === true) {
    // Stolperfalle: LLM antwortet match=true mit gefuellter Begruendung —
    // die Notes werden geleert (keine Begruendung ohne Mismatch).
    return {
      colorMatchSupplier: true,
      colorMatchNotes: '',
      proposedReviewStatus: 'ki_geprueft',
    }
  }
  if (llmMatch === false) {
    return {
      colorMatchSupplier: false,
      colorMatchNotes: llmNotes ?? '',
      proposedReviewStatus: 'zu_ueberarbeiten',
    }
  }

  return {
    colorMatchSupplier: null,
    colorMatchNotes: '',
    proposedReviewStatus: 'ki_geprueft',
  }
}

/**
 * Final-Status mit Override-Schutz: `abgenommen` und manuell gesetztes
 * `zu_ueberarbeiten` werden NICHT vom Pass-1-Lauf ueberschrieben
 * (Stolperfalle #16).
 *
 * Hinweis: der Postprocessor kann nicht unterscheiden, ob ein
 * `zu_ueberarbeiten` aus einem frueheren Pass-1-Mismatch stammt oder vom
 * Klassifizierer manuell gesetzt wurde. Wir behandeln BEIDE konservativ
 * als manuell — sonst koennte ein neuer Lauf mit zufaellig wieder
 * passendem Farbton den Status "automatisch reparieren" und die
 * Begruendung des Klassifizierers ueberschreiben.
 */
export function applyReviewStatusOverrideGuard(
  existing: ReviewStatus,
  proposed: 'ki_geprueft' | 'zu_ueberarbeiten',
): ReviewStatus {
  return PASS1_OVERRIDABLE_STATI.has(existing) ? proposed : existing
}

/**
 * Type-Guard: ist ein Wert ein gueltiger Review-Status?
 * Nutzt der Runner, um den existierenden Status aus dem Frontmatter zu
 * lesen (Frontmatter kommt als `Record<string, unknown>` zurueck).
 */
export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    value === 'nicht_geprueft' ||
    value === 'ki_geprueft' ||
    value === 'zu_ueberarbeiten' ||
    value === 'abgenommen'
  )
}
