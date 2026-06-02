/**
 * Generische Feld-Bindung des Wizards (ADR-0003 / O1, Phase 3a).
 *
 * Kerngedanke: Welche Felder der `editDraft`-Step zum Bearbeiten zeigt, soll
 * **generisch aus dem Schema** folgen — alle deklarierten Schema-Felder **ohne**
 * System-/Struktur-Felder, in Schema-Reihenfolge — statt aus einer pro Vorlage
 * hartkodierten `editDraft.fields`-Liste. Letztere bleibt nur noch **optionaler
 * Override** für die Feinkuratierung eines Steps.
 *
 * Empirisch (Kitchen-Sink): `editableContentFields(schema)` reproduziert für alle
 * Wizard-Vorlagen exakt deren handgeschriebene `editDraft.fields` — siehe
 * tests/unit/creation/editable-fields.test.ts.
 *
 * @see docs/adr/0003-wizard-schema-template-trennen.md (Nachtrag O1)
 */

import { TECHNICAL_REQUIRED_FIELDS } from '@/lib/detail-view-types/content-fields'

/**
 * Felder, die der Wizard **nicht** zum Bearbeiten anbietet: technische Felder
 * (aus B6: `language`, `targetLanguage`, `slug`, `docType`) plus strukturelle/
 * System-Felder. R3: System-Felder sind auto-gesetzt und nie editierbar.
 */
export const WIZARD_SYSTEM_FIELDS: ReadonlySet<string> = new Set<string>([
  ...Array.from(TECHNICAL_REQUIRED_FIELDS),
  'detailViewType',
  'source_language',
  'extends',
  'relatedSchemas',
  // R3 — auto-gesetzte System-Felder
  'originalFileId',
  'finalRunId',
  'eventStatus',
])

/** Ist dieses Feld ein System-/Struktur-Feld (nicht im Wizard editierbar)? */
export function isWizardSystemField(fieldKey: string): boolean {
  if (WIZARD_SYSTEM_FIELDS.has(fieldKey)) return true
  // Write-Keys (z.B. `testimonialWriteKey`) sind System-Felder.
  if (fieldKey.endsWith('WriteKey')) return true
  return false
}

/**
 * Generisch bearbeitbare Felder eines Schemas = alle Schema-Feld-Keys ohne
 * System-/Struktur-Felder, in **Schema-Reihenfolge**.
 */
export function editableContentFields(schemaFieldKeys: string[]): string[] {
  return schemaFieldKeys.filter((key) => !isWizardSystemField(key))
}
