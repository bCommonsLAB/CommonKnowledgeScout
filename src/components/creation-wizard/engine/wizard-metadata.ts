/**
 * Kanonische Lesequelle für Wizard-Metadaten/Markdown (Sub-Welle 3-VI-c / U2).
 *
 * Ersetzt die zuvor an mehreren Stellen kopierte Fallback-Kette
 * (`draftMetadata || reviewedFields || generatedDraft?.metadata`) durch EINE
 * gemeinsame, getestete Funktion. Reihenfolge = der bisher dominante Pfad
 * (Form-Modus `draftMetadata`/`draftText` vor Interview-`generatedDraft`),
 * damit die Adoption an handleSave/editDraft/uploadImages verhaltenstreu ist.
 *
 * Hinweis: Der previewDetail-Renderer benutzte historisch eine ABWEICHENDE
 * Reihenfolge (Drift). Seine Vereinheitlichung erfolgt separat und ist als
 * bewusste Verhaltensänderung markiert.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle c)
 */

import type { WizardState } from "./wizard-state"

type MetadataSlice = Pick<WizardState, "draftMetadata" | "reviewedFields" | "generatedDraft">
type MarkdownSlice = Pick<WizardState, "draftText" | "generatedDraft">

/** EINE kanonische Quelle der Wizard-Metadaten (statt verstreuter Fallback-Kette). */
export function selectCanonicalMetadata(state: MetadataSlice): Record<string, unknown> {
  return state.draftMetadata || state.reviewedFields || state.generatedDraft?.metadata || {}
}

/** EINE kanonische Quelle des Wizard-Markdown-Texts. */
export function selectCanonicalMarkdown(state: MarkdownSlice): string {
  return state.draftText || state.generatedDraft?.markdown || ""
}
