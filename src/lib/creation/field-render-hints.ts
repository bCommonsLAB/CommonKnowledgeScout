/**
 * Render-Hinweise für Schema-Felder im editDraft (ADR-0003 / O1, Phase 3a → U3).
 *
 * Schritt auf dem Weg zu „Render-Hinweise gehören ins Schema": Die bisher in
 * `edit-draft-step.tsx` verstreuten, namens-basierten Heuristiken (Label-Map,
 * Array-Erkennung) werden hier in EINE reine, getestete Quelle gezogen. Heute
 * spiegeln sie das Ist-Verhalten 1:1; sobald das Schema `inputType`/`label`
 * je Feld führt, bevorzugen diese Helfer die Schema-Metadaten und die
 * Heuristik wird zum reinen Fallback.
 *
 * @see docs/adr/0003-wizard-schema-template-trennen.md (Nachtrag O1)
 */

/** Minimaler Feld-Ausschnitt, den die Render-Hinweise brauchen. */
export interface FieldHintInput {
  key: string
  variable?: string
  description?: string
  rawValue?: string
}

/** Fallback-Labels für bekannte Feldnamen (1:1 aus edit-draft-step.tsx). */
const FIELD_LABEL_MAP: Record<string, string> = {
  title: "Titel",
  filename: "Dateiname (ohne .md)",
  shortTitle: "Kurztitel",
  summary: "Zusammenfassung",
  teaser: "Teaser",
  date: "Datum",
  starttime: "Startzeit",
  endtime: "Endzeit",
  location: "Ort",
  tags: "Tags",
  speakers: "Sprecher",
  affiliations: "Organisationen",
  topics: "Themen",
}

/** Feldnamen, die (auch ohne rawValue-Hinweis) als Mehrwert-Liste gelten. */
const ARRAY_FIELD_KEYS: ReadonlySet<string> = new Set(["tags", "topics", "affiliations"])

function findField(fieldKey: string, fields: readonly FieldHintInput[]): FieldHintInput | undefined {
  return fields.find((f) => f.key === fieldKey || f.variable === fieldKey)
}

/**
 * Benutzerfreundliches Label eines Feldes. Spiegelt `getFieldLabel`:
 * erster Satz der `description`, sonst Fallback-Map, sonst der Key selbst.
 */
export function resolveFieldLabel(fieldKey: string, fields: readonly FieldHintInput[]): string {
  const field = findField(fieldKey, fields)
  if (field?.description) {
    // Nutze den ersten Teil der Beschreibung als Label, falls vorhanden
    return field.description.split('.')[0] || fieldKey
  }
  return FIELD_LABEL_MAP[fieldKey] || fieldKey
}

/**
 * Soll der Wert dieses Feldes als Komma-Liste (Array) behandelt werden?
 * Spiegelt die Heuristik aus `updateFieldValue`: rawValue enthält "Array"
 * ODER bekannter Array-Feldname. Ohne passendes Schema-Feld: `false`.
 */
export function resolveFieldIsArrayInput(fieldKey: string, fields: readonly FieldHintInput[]): boolean {
  const field = findField(fieldKey, fields)
  if (!field) return false
  return field.rawValue?.includes("Array") === true || ARRAY_FIELD_KEYS.has(fieldKey)
}

/** Wizard-eigene Picker-Felder (Auswahl eines Folge-Wizards). */
export const WIZARD_PICKER_FIELD_KEYS: ReadonlySet<string> = new Set<string>([
  "wizard_testimonial_template_id",
  "wizard_finalize_template_id",
])

/** Wird dieses Feld als Auswahl-Picker (Folge-Wizard) gerendert? */
export function isWizardPickerField(fieldKey: string): boolean {
  return WIZARD_PICKER_FIELD_KEYS.has(fieldKey)
}

/**
 * Namens-Heuristik: soll das Feld mehrzeilig (Textarea) statt einzeilig
 * gerendert werden? Spiegelt die Bedingung aus `renderField` (ohne den
 * laufzeitabhängigen `isLongText`-Teil, der im Component bleibt).
 */
export function isTextareaFieldByName(fieldKey: string): boolean {
  return (
    fieldKey === "summary" ||
    fieldKey.includes("experience") ||
    fieldKey.includes("insight") ||
    fieldKey.includes("important")
  )
}
