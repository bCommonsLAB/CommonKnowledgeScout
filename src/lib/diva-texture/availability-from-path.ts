/**
 * @fileoverview Deterministische Pfad-Ableitung availability_scope/retailer_iln (Stufe 3).
 *
 * @description
 * Leitet die beiden Liefer-/Verfuegbarkeitsfelder rein deterministisch aus dem
 * Verzeichnispfad der Textur ab (Plan Section 5 + Stufe-3-Aufgabe). KEIN LLM,
 * KEINE Seiteneffekte:
 *  - Pfad enthaelt "DivaStandardMaterials" → globales Material:
 *    scope "basic", retailer_iln "".
 *  - sonst: 13-stellige ILN aus dem Pfad → scope "basic", retailer_iln = ILN.
 *  - keine ILN gefunden → scope "basic", retailer_iln "" (explizit, kein
 *    stiller Fehler-Default — scope ist laut Plan deterministisch "basic").
 */

/** Marker fuer globale DIVA-Standardmaterialien im Pfad. */
const DIVA_STANDARD_MARKER = 'divastandardmaterials'

/** 13-stellige ILN, nicht in eine laengere Ziffernfolge eingebettet. */
const ILN_PATTERN = /(?<!\d)(\d{13})(?!\d)/

/** Ergebnis der Pfad-Ableitung (flache Preprocess-Keys). */
export interface AvailabilityFromPath {
  availability_scope: 'basic'
  retailer_iln: string
}

/**
 * Leitet availability_scope + retailer_iln aus dem Texturpfad ab.
 *
 * @param filePath Voller Verzeichnis-/Dateipfad der Textur (z.B.
 *   "S:\\DIVA3DARCHIV\\0001445679013\\textures\\_tex\\..._basecolor.jpg").
 */
export function parseAvailabilityFromPath(filePath: string | null | undefined): AvailabilityFromPath {
  const path = typeof filePath === 'string' ? filePath : ''

  if (path.toLowerCase().includes(DIVA_STANDARD_MARKER)) {
    return { availability_scope: 'basic', retailer_iln: '' }
  }

  const match = path.match(ILN_PATTERN)
  return { availability_scope: 'basic', retailer_iln: match ? match[1] : '' }
}
