/**
 * @fileoverview DetailViewType — der Renderer einer Bibliothek als Contract
 *
 * @description
 * `detailViewType` bestimmt, welche Detailansicht ein Dokument bekommt. Der
 * Wert steht in der Library-Konfiguration und im Frontmatter jeder Vorlage —
 * er ist damit Teil des Steckbriefs, nicht ein Galerie-Implementierungsdetail.
 *
 * Nur die Aufzaehlung liegt hier. Zod-Schema, Feldlisten, Labels und die
 * Renderer-Zuordnung bleiben in `src/lib/detail-view-types/` — das Paket
 * beschreibt, es rechnet nicht (Muster aus `chat-vocabulary.ts`, Welle M4d).
 *
 * **Warum hier**: Die Werteliste existierte im Repo elfmal hartkodiert
 * (Galerie-Audit, Befund 3c). Zwei Orte fuer dieselbe Aufzaehlung laufen
 * frueher oder spaeter auseinander — elf sind bereits auseinandergelaufen.
 *
 * Abgrenzung zu `docType`: `docType` ist die Schema-Identitaet (welche Felder,
 * welcher Extractor), `detailViewType` der Renderer. Das Verhaeltnis ist n:1 —
 * mehrere docTypes teilen sich einen Renderer (ADR 0003).
 *
 * @module contracts/detail-view-type
 */

/**
 * Alle gueltigen Renderer-Typen.
 *
 * Reihenfolge ist die Anzeige-Reihenfolge in den Einstellungen.
 */
export const DETAIL_VIEW_TYPES = [
  'book',
  'session',
  'testimonial',
  'blog',
  'climateAction',
  'divaDocument',
  'divaTexture',
  'refurbedDevice',
  'website',
] as const

/** Union aller gueltigen Renderer-Typen. */
export type DetailViewType = (typeof DETAIL_VIEW_TYPES)[number]

/**
 * Prueft, ob ein unbekannter Wert ein gueltiger Renderer-Typ ist.
 *
 * Bewusst hier und nicht nur in der App: Wer den Vertrag liest, braucht auch
 * die Pruefung — sonst entsteht die naechste Kopie.
 */
export function isDetailViewType(value: unknown): value is DetailViewType {
  return typeof value === 'string' && (DETAIL_VIEW_TYPES as readonly string[]).includes(value)
}
