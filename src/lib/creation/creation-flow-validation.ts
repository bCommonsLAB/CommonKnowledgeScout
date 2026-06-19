/**
 * Creation-Flow-Validierung (Plan 2 · W-G / Δ5).
 *
 * Reine Typ-Guards fuer eine `TemplateCreationConfig` (Wizard-Flow) — aus dem
 * eingebetteten `CreationFlowEditor` (structured-template-editor.tsx)
 * herausgeloest, damit der kuenftige **eigenstaendige** Wizard-Editor (auf der
 * geteilten Flow-Entitaet) dieselbe Validierung wiederverwendet, statt sie zu
 * duplizieren. Kein React, kein Storage → voll unit-testbar.
 */

import type { TemplateCreationConfig } from '@/lib/templates/template-types'

/** Plain-Object-Guard (kein Array, kein null). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Array-aus-Strings-Guard. */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

/** Guard fuer eine Quelle (`supportedSources[]`). */
export function isSupportedSource(
  value: unknown,
): value is { id: string; type: string; label: string; helpText?: string } {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (value.helpText !== undefined && typeof value.helpText !== 'string') return false
  return true
}

/** Guard fuer einen Flow-Schritt (`flow.steps[]`). */
export function isFlowStep(
  value: unknown,
): value is { id: string; preset: string; title?: string; description?: string; fields?: string[]; imageFieldKeys?: string[] } {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.preset !== 'string') return false
  if (value.title !== undefined && typeof value.title !== 'string') return false
  if (value.description !== undefined && typeof value.description !== 'string') return false
  if (value.fields !== undefined && !isStringArray(value.fields)) return false
  if (value.imageFieldKeys !== undefined && !isStringArray(value.imageFieldKeys)) return false
  return true
}

/** Voll-Guard fuer eine `TemplateCreationConfig` (Import-Validierung). */
export function isTemplateCreationConfig(value: unknown): value is TemplateCreationConfig {
  if (!isRecord(value)) return false
  if (!Array.isArray(value.supportedSources) || !value.supportedSources.every(isSupportedSource)) return false
  if (!isRecord(value.flow)) return false
  if (!Array.isArray(value.flow.steps) || !value.flow.steps.every(isFlowStep)) return false
  if (value.followWizards !== undefined) {
    if (!isRecord(value.followWizards)) return false
    const fw = value.followWizards as Record<string, unknown>
    if (fw.testimonialTemplateId !== undefined && typeof fw.testimonialTemplateId !== 'string') return false
    if (fw.finalizeTemplateId !== undefined && typeof fw.finalizeTemplateId !== 'string') return false
    if (fw.publishTemplateId !== undefined && typeof fw.publishTemplateId !== 'string') return false
  }
  // Optionale Bloecke: preview/output/ui/welcome
  if (value.preview !== undefined) {
    if (!isRecord(value.preview)) return false
    if (value.preview.detailViewType !== undefined && typeof value.preview.detailViewType !== 'string') return false
  }
  if (value.output !== undefined && !isRecord(value.output)) return false
  if (value.ui !== undefined && !isRecord(value.ui)) return false
  if (value.welcome !== undefined && !isRecord(value.welcome)) return false
  return true
}
