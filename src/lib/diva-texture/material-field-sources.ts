/**
 * @fileoverview Quellen-Map der Material-Preprocess-Felder (Stufe 2).
 *
 * @description
 * Maschinenlesbare Fassung von Leas Farb-Legende: dokumentiert pro
 * Frontmatter-Feld, WOHER der Wert stammt (Lea-Regel #4: "Konfidenz pro Feld
 * + Quelle dokumentieren"). Single Source of Truth fuer:
 *  - die Pass-Zuordnung im Template (welcher LLM-Pass fuellt welches Feld),
 *  - die Feld-Auswahl je Pipeline-Pass (Stufe 3/5 filtern hierueber),
 *  - die spaetere UI-Quellen-Anzeige + Provenienz am Material.
 *
 * Bezieht sich auf die FLACHEN snake_case-Keys des Preprocess-Templates
 * (template-samples/Diva-Texture-Analysis.md), NICHT auf das verschachtelte
 * Material-Digital-Twin-Modell.
 *
 * Rein deterministisch, KEIN LLM-Call, KEINE Seiteneffekte.
 */

/**
 * Herkunft eines Feldwertes (Quell-Achse aus Leas Legende).
 *
 * Hinweis: Leas gruene/rote Markierungen sind Status/Entscheidung
 * (umgesetzt bzw. offen), KEINE Quelle — sie stehen daher nicht hier.
 */
export type MaterialFieldSource =
  /** Stammdaten aus dem Liefersystem / Bestandssystem (Sidecar). */
  | 'divadata'
  /** 1. LLM-Lauf: material_class + material_type + zugehoerige Konfidenz. */
  | 'ai_pass1'
  /** 2. LLM-Lauf: Farbe + visuelle Eigenschaften + zugehoerige Konfidenz. */
  | 'ai_pass2'
  /** aiGenerationHints: werden in jedem Lauf neu erzeugt → letzter Pass. */
  | 'ai_last_pass'
  /** Deterministisch aus dem Verzeichnispfad/Dateinamen extrahiert. */
  | 'path'
  /** System-/Pipeline-Status (kein vom LLM gelieferter Wert). */
  | 'pipeline'

/**
 * Feld-Key → Herkunft. Keys sind die flachen Frontmatter-Keys des
 * Preprocess-Templates.
 */
export const MATERIAL_FIELD_SOURCES: Readonly<Record<string, MaterialFieldSource>> = {
  // Identitaet / Stammdaten
  title: 'divadata',
  slug: 'divadata',
  // Deterministisch aus dem Pfad
  iln_nummer: 'path',
  textur_code: 'path',
  availability_scope: 'path',
  retailer_iln: 'path',
  // 1. LLM-Pass: Klasse + Typ
  material_class: 'ai_pass1',
  material_type: 'ai_pass1',
  confidence_class: 'ai_pass1',
  confidence_type: 'ai_pass1',
  needs_human_review: 'ai_pass1',
  // 2. LLM-Pass: Farbe + visuelle Eigenschaften
  dominant_color_hex: 'ai_pass2',
  color_family: 'ai_pass2',
  color_description: 'ai_pass2',
  surface_finish: 'ai_pass2',
  surface_relief: 'ai_pass2',
  pattern_scale: 'ai_pass2',
  directionality: 'ai_pass2',
  perceived_softness: 'ai_pass2',
  color_variation: 'ai_pass2',
  confidence_visual: 'ai_pass2',
  // aiGenerationHints: immer der zuletzt gelaufene Pass
  ai_prompt_positive: 'ai_last_pass',
  ai_prompt_negative: 'ai_last_pass',
  ai_realism_notes: 'ai_last_pass',
  // Pipeline-/System-Status (nicht vom LLM, nicht im Antwortschema)
  last_pass: 'pipeline',
  pass1_status: 'pipeline',
  pass2_status: 'pipeline',
} as const

/** Liefert die Herkunft eines Feldes oder `undefined`, wenn unbekannt. */
export function getFieldSource(field: string): MaterialFieldSource | undefined {
  return MATERIAL_FIELD_SOURCES[field]
}

/** Alle Feld-Keys mit der angegebenen Herkunft. */
export function fieldsForSource(source: MaterialFieldSource): string[] {
  return Object.entries(MATERIAL_FIELD_SOURCES)
    .filter(([, src]) => src === source)
    .map(([key]) => key)
}

/**
 * LLM-Felder, die ein bestimmter Pass anfragt.
 *
 * aiGenerationHints (`ai_last_pass`) laufen in BEIDEN Paessen mit, weil sie in
 * jedem Lauf neu erzeugt werden und sich auf den jeweils letzten Pass beziehen.
 *
 * @param pass 1 = Klasse/Typ, 2 = visuelle Eigenschaften
 */
export function llmFieldsForPass(pass: 1 | 2): string[] {
  const passSource: MaterialFieldSource = pass === 1 ? 'ai_pass1' : 'ai_pass2'
  return [...fieldsForSource(passSource), ...fieldsForSource('ai_last_pass')]
}
