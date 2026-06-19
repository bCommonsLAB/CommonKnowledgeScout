/**
 * Editor-Logik fuer die Wizard-Kuratierung (Plan 2 · W-C-2).
 *
 * Reine Helfer fuer den `CaptureWizardsEditor`: aus der Liste der verfuegbaren
 * Wizards + der aktuellen Config bearbeitbare Zeilen bauen, Zeilen umschalten/
 * verschieben und wieder in eine `CaptureWizardsConfig` serialisieren.
 *
 * Kein React, kein Storage → voll unit-testbar. Die UI bleibt damit duenn.
 */

import type { CaptureWizardRef, CaptureWizardsConfig } from '@/types/library'

/** Minimal-Info eines verfuegbaren Wizards (aus der Creation-Typ-Liste). */
export interface AvailableWizard {
  flowId: string
  label: string
}

/** Eine bearbeitbare Editor-Zeile (Reihenfolge = Array-Reihenfolge). */
export interface EditableWizardRow {
  flowId: string
  label: string
  enabled: boolean
}

/**
 * Baut die Editor-Zeilen: zuerst die in der Config gelisteten (in deren
 * Reihenfolge, mit ihren `enabled`-Flags/Label-Overrides), dann die uebrigen
 * verfuegbaren Wizards (als deaktiviert angehaengt). Ohne Config sind alle
 * verfuegbaren Wizards deaktiviert (Owner aktiviert bewusst, Entscheidung #3).
 */
export function buildEditableRows(
  available: readonly AvailableWizard[],
  config: CaptureWizardsConfig | undefined,
): EditableWizardRow[] {
  const byId = new Map(available.map((a) => [a.flowId, a]))
  const rows: EditableWizardRow[] = []
  const seen = new Set<string>()

  for (const ref of config?.wizards ?? []) {
    if (seen.has(ref.flowId)) continue
    seen.add(ref.flowId)
    rows.push({
      flowId: ref.flowId,
      label: ref.label ?? byId.get(ref.flowId)?.label ?? ref.flowId,
      enabled: ref.enabled,
    })
  }
  for (const a of available) {
    if (seen.has(a.flowId)) continue
    seen.add(a.flowId)
    rows.push({ flowId: a.flowId, label: a.label, enabled: false })
  }
  return rows
}

/** Schaltet eine Zeile an/aus (unveraenderliche Kopie). */
export function toggleRow(rows: readonly EditableWizardRow[], flowId: string): EditableWizardRow[] {
  return rows.map((r) => (r.flowId === flowId ? { ...r, enabled: !r.enabled } : r))
}

/** Verschiebt eine Zeile um eine Position (`-1` hoch, `+1` runter). */
export function moveRow(
  rows: readonly EditableWizardRow[],
  flowId: string,
  delta: -1 | 1,
): EditableWizardRow[] {
  const idx = rows.findIndex((r) => r.flowId === flowId)
  if (idx === -1) return [...rows]
  const target = idx + delta
  if (target < 0 || target >= rows.length) return [...rows]
  const next = [...rows]
  ;[next[idx], next[target]] = [next[target], next[idx]]
  return next
}

/**
 * Serialisiert die Zeilen in eine `CaptureWizardsConfig`. `defaultFlowId` wird
 * nur uebernommen, wenn die Zeile existiert UND aktiviert ist (sonst entfernt —
 * kein verwaister Default).
 */
export function rowsToConfig(
  rows: readonly EditableWizardRow[],
  defaultFlowId: string | undefined,
): CaptureWizardsConfig {
  const wizards: CaptureWizardRef[] = rows.map((r) => ({ flowId: r.flowId, label: r.label, enabled: r.enabled }))
  const defaultRow = rows.find((r) => r.flowId === defaultFlowId)
  const validDefault = defaultRow && defaultRow.enabled ? defaultFlowId : undefined
  return validDefault ? { wizards, defaultFlowId: validDefault } : { wizards }
}
