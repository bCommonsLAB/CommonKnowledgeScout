/**
 * Inhaltliche vs. technische Pflichtfelder eines DetailViewType.
 *
 * Hintergrund (B6): Jeder Wizard/Flow erzeugt ein Ergebnis eines bestimmten
 * `detailViewType`. Dessen Pflichtfelder (`VIEW_TYPE_REGISTRY.requiredFields`)
 * sind das, was am Ende stimmen muss. Für die **menschliche Abnahme** (ADR-0004)
 * und die **generische Feld-Bindung** des Wizards (ADR-0003 / O1) zählen aber nur
 * die **inhaltlichen** Pflichtfelder — technische Felder (Sprache, Slug, …) sind
 * automatisch gesetzt und gehören nicht in die redaktionelle Abnahme.
 *
 * Diese Funktion leitet die inhaltlichen Pflichtfelder **systemisch** aus der
 * Registry ab — nicht pro Vorlage diktiert.
 *
 * @see docs/wizards/abnahme-inbox-plan.md (Baustein B6)
 * @see docs/wizards/dokument-upload-analyse-publizieren.md
 */

import { getRequiredFields } from './registry'

/**
 * Technische/System-Pflichtfelder, die NICHT Teil der menschlichen Abnahme sind
 * und nicht generisch im Wizard gebunden werden. Bewusst zentrale, kleine Liste
 * (Start laut Entscheidung 2026-06-02). Erweiterbar, wenn weitere rein technische
 * Pflichtfelder auftauchen.
 */
export const TECHNICAL_REQUIRED_FIELDS: ReadonlySet<string> = new Set<string>([
  'language',
  'targetLanguage',
  'slug',
  'docType',
])

/** Ist dieses Feld ein technisches/System-Feld (nicht zur Abnahme)? */
export function isTechnicalField(fieldKey: string): boolean {
  return TECHNICAL_REQUIRED_FIELDS.has(fieldKey)
}

/**
 * Inhaltliche Pflichtfelder eines DetailViewType
 * = `requiredFields` (aus der Registry) **ohne** technische Felder.
 *
 * Unbekannter ViewType → `[]` (kein stiller Fehler; `getRequiredFields` liefert
 * bereits `[]` für Unbekanntes).
 */
export function contentRequiredFields(viewType: string | undefined): string[] {
  if (!viewType) return []
  return getRequiredFields(viewType).filter((field) => !isTechnicalField(field))
}
