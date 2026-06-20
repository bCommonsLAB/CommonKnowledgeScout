/**
 * Wizard-Kuratierung (Plan 2 · W-B / Δ2 Teil 1).
 *
 * Heute listet „Inhalte erfassen" AUTOMATISCH alle Templates mit `creation`-
 * Block. W-B fuehrt die **kuratierte** Liste ein: pro Library bewusst gewaehlte
 * Wizards in fester Reihenfolge. Dieses Modul ist die reine Auswahl-/Sortier-
 * Engine (kein Storage, kein React) und damit voll unit-testbar.
 *
 * Owner-Entscheidung 2026-06-18 (#3): Fehlt die Kuratierungs-Config, ist NUR der
 * generische Standard-Wizard sichtbar — kein stiller Voll-Dump aller Templates.
 * (Aktiviert wird dieser Default mit W-C, das das Config-Feld + die Settings-UI
 * liefert; bis dahin reicht der Aufrufer keine Config durch → Bestandsverhalten.)
 */

import type { LibraryCreationType } from '@/lib/templates/library-creation-config'
import type { CaptureWizardRef, CaptureWizardsConfig } from '@/types/library'
import { STANDARD_CAPTURE_FLOW_ID } from './wizard-flow-entity'

// Re-Export, damit Bestands-Importe aus diesem Modul weiter funktionieren.
export type { CaptureWizardRef, CaptureWizardsConfig }

/**
 * Der generische Standard-Wizard als Auswahl-Karte.
 *
 * W-D-Fix: Die Karte traegt zwar die Identitaet `standard-capture` (Route +
 * Kuratierungs-Referenz), laeuft aber ueber den **erprobten** generischen Flow
 * `file-transcript-de` (vollwertiges Template mit Systemprompt). Der reine
 * Flow-Entitaets-Eintrag `standard-capture` allein ist nicht transformierbar
 * (kein Schema/Systemprompt) — er dient erst, wenn ein gespeicherter, gebundener
 * Flow existiert (W-A/W-G).
 */
export function buildStandardWizardCreationType(): LibraryCreationType {
  return {
    id: STANDARD_CAPTURE_FLOW_ID,
    label: 'Inhalt erfassen',
    description: 'Quelle hochladen, Inhaltstyp waehlen und als Beitrag in den Wartekorb legen',
    templateId: 'file-transcript-de',
    icon: 'Upload',
    source: 'builtin',
    isReadonly: true,
  }
}

/** Findet den zu einem `flowId` passenden Creation-Typ (id ODER templateId). */
function resolveRef(
  ref: CaptureWizardRef,
  available: readonly LibraryCreationType[],
  standardWizard: LibraryCreationType,
): LibraryCreationType | null {
  if (ref.flowId === STANDARD_CAPTURE_FLOW_ID) return standardWizard
  const match = available.find((t) => t.id === ref.flowId || t.templateId === ref.flowId)
  if (!match) {
    console.warn(`[capture-wizards] Kuratierter Wizard „${ref.flowId}" nicht gefunden — uebersprungen.`)
    return null
  }
  return match
}

/** Wendet optionale Label-/Icon-Ueberschreibungen eines Refs an. */
function applyOverrides(type: LibraryCreationType, ref: CaptureWizardRef): LibraryCreationType {
  if (!ref.label && !ref.icon) return type
  return { ...type, label: ref.label ?? type.label, icon: ref.icon ?? type.icon }
}

/**
 * Kuratiert die Creation-Typen: geordnet, nur aktivierte, Default zuerst.
 * Fehlt/leer die Config → nur der Standard-Wizard (Entscheidung #3).
 */
export function curateCreationTypes(
  available: readonly LibraryCreationType[],
  config: CaptureWizardsConfig | undefined,
  opts: { standardWizard: LibraryCreationType },
): LibraryCreationType[] {
  const standardWizard = opts.standardWizard
  if (!config || config.wizards.length === 0) return [standardWizard]

  const enabled = config.wizards.filter((w) => w.enabled)
  // Default-Flow nach vorne ziehen (falls gesetzt + enthalten).
  const ordered = config.defaultFlowId
    ? [
        ...enabled.filter((w) => w.flowId === config.defaultFlowId),
        ...enabled.filter((w) => w.flowId !== config.defaultFlowId),
      ]
    : enabled

  const out: LibraryCreationType[] = []
  const seen = new Set<string>()
  for (const ref of ordered) {
    const resolved = resolveRef(ref, available, standardWizard)
    if (!resolved || seen.has(resolved.id)) continue
    seen.add(resolved.id)
    out.push(applyOverrides(resolved, ref))
  }
  return out
}
