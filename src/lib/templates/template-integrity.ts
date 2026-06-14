/**
 * Template-Integritaets-Gate (Welle A0).
 *
 * Selbst-enthaltene Pruefung, ob eine Vorlage den deterministischen
 * Konsistenz-Contract erfuellt: Sie deklariert einen gueltigen Inhaltstyp und
 * deckt sowohl dessen Pflichtfelder (Registry) als auch die verbindlichen
 * Basis-Felder (base-fields.ts) ab.
 *
 * Wird an den SCHREIB-Engpaessen ERZWUNGEN (Template-Create/Update via API und
 * Template-Import). Bestand wird NICHT retro-geprueft (Grandfathering,
 * Entscheidung 2026-06-14) — das uebernimmt die Library-Verifikation (Welle A1).
 *
 * Abgrenzung: `checkTemplateConsistency` (template-consistency.ts) prueft die
 * BINDUNG Template <-> Library-Inhaltstyp und braucht den Library-Kontext. Diese
 * Funktion prueft die Vorlage fuer sich allein (no-silent-fallbacks.mdc).
 */

import { isValidDetailViewType } from '@/lib/detail-view-types/registry'
import { validateTemplateForViewType } from '@/lib/detail-view-types/validation'
import { missingBaseFields } from '@/lib/detail-view-types/base-fields'

export interface TemplateIntegrityInput {
  /** Feld-Keys der Vorlage (metadata.fields[].key) */
  fieldKeys: string[]
  /** Deklarierter Inhaltstyp (metadata.detailViewType) */
  detailViewType?: string | null
  /** Name fuer lesbare Meldungen */
  templateName?: string
}

export interface TemplateIntegrityResult {
  /** true, wenn keine harten Fehler vorliegen (darf gespeichert/importiert werden). */
  ok: boolean
  /** Harte Fehler — blockieren das Speichern/Importieren. */
  errors: string[]
  /** Hinweise (z.B. fehlende empfohlene Felder) — blockieren nicht. */
  warnings: string[]
}

/**
 * Wird an den Schreib-Engpaessen geworfen, wenn eine Vorlage den
 * Konsistenz-Contract verletzt. Aufrufer (API-Routen) mappen das auf 422.
 */
export class TemplateIntegrityError extends Error {
  readonly errors: string[]
  readonly warnings: string[]
  constructor(errors: string[], warnings: string[] = []) {
    super(`Vorlage verletzt den Konsistenz-Contract: ${errors.join(' ')}`)
    this.name = 'TemplateIntegrityError'
    this.errors = errors
    this.warnings = warnings
  }
}

/**
 * Prueft die Integritaet einer Vorlage gegen den Konsistenz-Contract.
 * Gibt strukturierte Fehler/Warnungen zurueck (kein Throw), damit Aufrufer
 * HTTP-Status/Logging selbst bestimmen.
 */
export function validateTemplateIntegrity(input: TemplateIntegrityInput): TemplateIntegrityResult {
  const errors: string[] = []
  const warnings: string[] = []
  const name = (input.templateName ?? '').trim() || 'Vorlage'
  const viewType = (input.detailViewType ?? '').trim()

  if (!viewType) {
    errors.push(`${name}: kein detailViewType deklariert — der Inhaltstyp ist nicht bestimmbar.`)
  } else if (!isValidDetailViewType(viewType)) {
    errors.push(`${name}: unbekannter detailViewType „${viewType}".`)
  } else {
    const v = validateTemplateForViewType(input.fieldKeys, viewType)
    if (!v.isValid) {
      errors.push(`${name}: Pflichtfelder fuer „${viewType}" fehlen: ${v.missingRequired.join(', ')}.`)
    }
    if (v.missingOptional.length > 0) {
      warnings.push(`${name}: empfohlene Felder fuer „${viewType}" fehlen: ${v.missingOptional.join(', ')}.`)
    }
  }

  const missingBase = missingBaseFields(input.fieldKeys)
  if (missingBase.length > 0) {
    errors.push(`${name}: verbindliche Basis-Felder fehlen: ${missingBase.join(', ')}.`)
  }

  return { ok: errors.length === 0, errors, warnings }
}
