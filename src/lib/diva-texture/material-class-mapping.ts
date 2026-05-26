/**
 * @fileoverview DE→EN-Material-Mapping (Stufe 2).
 *
 * @description
 * Uebersetzt den deutschen `Material`-Wert aus den Liefersystem-Stammdaten
 * (Sidecar `api2_GetJsonOptionValues.json`, z.B. "STOFF") in die englische
 * `materialClass` des Material-Digital-Twin-Modells (z.B. "fabric").
 *
 * Rein deterministisch, KEIN LLM-Call, KEINE Seiteneffekte (kein Logging).
 * Unbekannte Werte werden NICHT still auf einen Default gemappt
 * (siehe no-silent-fallbacks.mdc): die Funktion meldet `isKnown: false`,
 * der Aufrufer entscheidet ueber Warnung/LLM-Fallback (Plan Edge-Case #4).
 *
 * Quelle der Tabelle: Plan-Section 5 (DE→EN-Material-Mapping). Verfeinerung
 * (z.B. MARMOR→materialType "marble") ist Stufe 3 vorbehalten.
 */

/**
 * Gueltige Material-Klassen des Digital-Twin-Modells.
 * Quelle: docs/diva-texture-analysen/material-digital-twin.md ("Gueltige
 * Material Klassifikation").
 */
export type MaterialClass =
  | 'fabric'
  | 'leather'
  | 'wood'
  | 'metal'
  | 'glass'
  | 'stone'
  | 'ceramic'
  | 'plastic'
  | 'natural_fiber'
  | 'composite'
  | 'cork'
  | 'paper'
  | 'foam'

/** Ergebnis des DE→EN-Mappings. */
export interface MaterialClassMapping {
  /** Englische materialClass — `null`, wenn der DE-Wert unbekannt ist. */
  materialClass: MaterialClass | null
  /**
   * Optionaler deterministisch ableitbarer materialType
   * (z.B. "faux_leather" fuer KUNSTLEDER). Nur gesetzt, wenn der DE-Wert
   * den Typ eindeutig festlegt.
   */
  materialType?: string
  /** `false`, wenn der Eingabewert nicht in der Mapping-Tabelle steht. */
  isKnown: boolean
}

/** Interner Tabelleneintrag. */
interface MappingEntry {
  materialClass: MaterialClass
  materialType?: string
}

/**
 * DE→EN-Tabelle. Keys sind getrimmt + upper-case normalisiert.
 * (Map statt enum/Record gemaess Projektkonvention.)
 */
const DE_TO_EN: ReadonlyMap<string, MappingEntry> = new Map<string, MappingEntry>([
  ['STOFF', { materialClass: 'fabric' }],
  ['LEDER', { materialClass: 'leather' }],
  ['KUNSTLEDER', { materialClass: 'leather', materialType: 'faux_leather' }],
  ['HOLZ', { materialClass: 'wood' }],
  ['STEIN', { materialClass: 'stone' }],
  ['MARMOR', { materialClass: 'stone' }],
  ['GRANIT', { materialClass: 'stone' }],
  ['METALL', { materialClass: 'metal' }],
  ['GLAS', { materialClass: 'glass' }],
  ['KUNSTSTOFF', { materialClass: 'plastic' }],
  ['LACK', { materialClass: 'plastic' }],
])

/**
 * Mappt einen deutschen Liefersystem-Materialwert auf die Digital-Twin-Klasse.
 *
 * @param rawMaterial Roh-Wert aus der Sidecar (`OptionvalueEntry.Material`),
 *   z.B. "STOFF" oder "  leder ". Gross-/Kleinschreibung + Whitespace egal.
 * @returns Mapping-Ergebnis; `materialClass: null` + `isKnown: false` fuer
 *   unbekannte oder leere Werte.
 */
export function mapMaterialClass(
  rawMaterial: string | null | undefined,
): MaterialClassMapping {
  if (rawMaterial === null || rawMaterial === undefined) {
    return { materialClass: null, isKnown: false }
  }

  const key = rawMaterial.trim().toUpperCase()
  if (key === '') {
    return { materialClass: null, isKnown: false }
  }

  const entry = DE_TO_EN.get(key)
  if (entry === undefined) {
    return { materialClass: null, isKnown: false }
  }

  return {
    materialClass: entry.materialClass,
    materialType: entry.materialType,
    isKnown: true,
  }
}

/** Alle bekannten DE-Schluessel (z.B. fuer UI-Hinweise oder Tests). */
export function knownMaterialKeys(): string[] {
  return Array.from(DE_TO_EN.keys())
}
