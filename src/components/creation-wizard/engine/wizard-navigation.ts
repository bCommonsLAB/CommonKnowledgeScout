/**
 * Generische Vorwärts-Navigation der Wizard-Engine (Sub-Welle 3-VI-d / U1).
 *
 * Reiner, seiteneffektfreier Kern der „Weiter"-Logik: berechnet den nächsten
 * Step-Index aus dem aktuellen Zustand. 1:1 aus dem generischen Advance-Block
 * von `handleNext` (creation-wizard.tsx) herausgelöst — **ohne**
 * Template-Spezialfälle (PDF-HITL, Publish/Completion-Routing); die bleiben
 * vorerst im Kern und werden in Sub-Welle 3-VI-e entkoppelt.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle d, Commit 4)
 */

import type { CreationFlowStepPreset, CreationFlowStepRef } from "@/lib/templates/template-types"

export interface NextStepIndexContext {
  currentStepIndex: number
  mode?: 'interview' | 'form'
  /** Ist bereits eine Quelle gewählt? (für chooseSource-Skip) */
  hasSelectedSource: boolean
  /** Existiert bereits ein generierter Draft? (für generateDraft-Skip) */
  hasGeneratedDraft: boolean
}

/**
 * Liefert den Ziel-`currentStepIndex` für „Weiter" im generischen Fall.
 * Spiegelt die Skip-Regeln aus `handleNext` exakt:
 * - Form-Modus überspringt Zwischenschritte bis `editDraft` — aber NIE `collectSource`.
 * - `chooseSource` wird übersprungen, wenn schon eine Quelle gewählt ist.
 * - `generateDraft` wird übersprungen, wenn schon ein Draft existiert.
 */
export function resolveNextStepIndex(
  ctx: NextStepIndexContext,
  steps: readonly Pick<CreationFlowStepRef, 'preset'>[]
): number {
  const { currentStepIndex, mode, hasSelectedSource, hasGeneratedDraft } = ctx
  const nextRawIndex = currentStepIndex + 1
  const nextPreset: CreationFlowStepPreset | undefined = steps[nextRawIndex]?.preset
  const lastIndex = steps.length - 1

  // UX: Form-Modus kann Zwischenschritte überspringen — aber collectSource NIEMALS,
  // sonst fehlt die Quelle (Text/Datei/URL) und Nutzer landen direkt im editDraft.
  if (mode === 'form') {
    if (nextPreset === 'collectSource') return nextRawIndex
    const editDraftIndex = steps.findIndex((s, idx) => idx > currentStepIndex && s.preset === 'editDraft')
    if (editDraftIndex >= 0) return editDraftIndex
  }

  if (nextPreset === 'chooseSource' && hasSelectedSource) return Math.min(nextRawIndex + 1, lastIndex)

  // UX: Wenn bereits ein Draft existiert (z.B. durch Multi-Source Re-Extract),
  // ist generateDraft redundant. Nur überspringen, wenn der Draft wirklich da ist.
  if (nextPreset === 'generateDraft' && hasGeneratedDraft) return Math.min(nextRawIndex + 1, lastIndex)

  return nextRawIndex
}
