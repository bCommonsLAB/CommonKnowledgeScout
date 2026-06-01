/**
 * src/lib/gallery/rating.ts
 *
 * Prioritaets-Rating fuer bewertete Dokumente (z. B. Klimamassnahmen).
 *
 * Roh-Formel (Zielbild §4.3):
 *   rating_raw = ( impact * feasibility ) / cost
 *
 * Fuer Klimamassnahmen ist `impact = co2_einsparung_kt`,
 * `feasibility = durchsetzbarkeit (0..1)` und `cost = kosten_eur`.
 *
 * Bewusst GENERISCH gehalten (keine Klima-Feldnamen), damit andere
 * Libraries dieselbe Util mit eigenen Zahlen nutzen koennen.
 *
 * Keine Silent Fallbacks (siehe `.cursor/rules/no-silent-fallbacks.mdc`):
 * Fehlende Kosten oder `cost <= 0` werden NICHT mit einem Epsilon
 * "weggerechnet" (das wuerde solche Dokumente faelschlich nach oben
 * schiessen lassen), sondern als `unknown-cost` markiert. Solche
 * Dokumente bekommen kein Rating und werden in der Sortierung explizit
 * ans Ende gestellt.
 */

/** Eingangswerte fuer das Roh-Rating (alle optional, weil LLM-geschaetzt). */
export interface RatingInput {
  /** Direkte Wirkung (z. B. CO2-Einsparung in kt/Jahr). */
  impact?: number | null
  /** Durchsetzbarkeit / Machbarkeit, erwartet im Bereich 0..1. */
  feasibility?: number | null
  /** Kosten (z. B. EUR). `<= 0` oder fehlend -> "Kosten unbekannt". */
  cost?: number | null
}

/** Ergebnis der Roh-Rating-Berechnung (diskriminierte Union). */
export type RatingRawResult =
  /** Vollstaendige Daten -> berechneter Roh-Wert (>= 0). */
  | { status: 'ok'; raw: number }
  /** Kosten fehlen oder sind `<= 0` -> Rating bewusst nicht berechenbar. */
  | { status: 'unknown-cost' }
  /** Impact oder Feasibility fehlen -> zu wenig Daten fuer ein Rating. */
  | { status: 'insufficient' }

/**
 * Prueft, ob ein Wert eine endliche Zahl ist.
 */
function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Berechnet das Roh-Rating fuer ein Dokument.
 *
 * @param input Impact/Feasibility/Cost (LLM-geschaetzt, teils fehlend)
 * @returns Diskriminiertes Ergebnis (`ok` | `unknown-cost` | `insufficient`)
 */
export function computeRatingRaw(input: RatingInput): RatingRawResult {
  const { impact, feasibility, cost } = input

  // Impact und Feasibility sind Pflicht fuer ein aussagekraeftiges Rating.
  if (!isFiniteNumber(impact) || !isFiniteNumber(feasibility)) {
    return { status: 'insufficient' }
  }

  // Kosten fehlen/0/negativ -> explizit "Kosten unbekannt", kein Epsilon-Trick.
  if (!isFiniteNumber(cost) || cost <= 0) {
    return { status: 'unknown-cost' }
  }

  return { status: 'ok', raw: (impact * feasibility) / cost }
}

/**
 * Anzeige-tauglicher Prioritäts-Indikator: der Roh-Wert skaliert auf "je Mio."
 * der Kosten-Einheit (raw × 1_000_000), damit eine lesbare Zahl entsteht
 * (z. B. 2.4 statt 0.0000024). Identischer Wert in Galerie UND Detailansicht.
 * `null`, wenn nicht berechenbar (Kosten unbekannt / zu wenig Daten).
 */
export function computePriorityIndexDisplay(input: RatingInput): number | null {
  const result = computeRatingRaw(input)
  return result.status === 'ok' ? result.raw * 1_000_000 : null
}

/**
 * Berechnet den Perzentil-Score (0..100) eines Roh-Werts relativ zu einer
 * Verteilung aller Roh-Werte einer Library/Auswahl.
 *
 * Definition: `0` = schwaechster Wert, `100` = staerkster Wert. Gleiche
 * Werte erhalten denselben Perzentil. Bei nur einem Wert -> `100` (er ist
 * zugleich Top und Boden, die Spitze ist die intuitivere Anzeige).
 *
 * @param value Roh-Wert des betrachteten Dokuments
 * @param allRawValues Alle gueltigen Roh-Werte (inkl. `value`)
 * @returns Perzentil 0..100 (gerundet), oder `undefined` bei leerer Menge
 */
export function computeRatingPercentile(
  value: number,
  allRawValues: number[],
): number | undefined {
  const values = allRawValues.filter(isFiniteNumber)
  const n = values.length
  if (n === 0) return undefined
  if (n === 1) return 100

  const countBelow = values.filter(v => v < value).length
  return Math.round((countBelow / (n - 1)) * 100)
}

/**
 * Weist einer Liste von Dokumenten ihren Perzentil-Score zu.
 *
 * Dokumente ohne gueltiges Roh-Rating (`undefined`/`null`) bleiben ohne
 * Perzentil (`undefined`) und werden NICHT in die Verteilung einbezogen —
 * "Kosten unbekannt" verfaelscht so die Skala nicht.
 *
 * @param rawValues Roh-Werte pro Dokument (in Eingangsreihenfolge)
 * @returns Perzentile pro Dokument (gleiche Reihenfolge), `undefined` wo kein Roh-Wert
 */
export function assignRatingPercentiles(
  rawValues: Array<number | null | undefined>,
): Array<number | undefined> {
  const valid = rawValues.filter(isFiniteNumber)
  return rawValues.map(v =>
    isFiniteNumber(v) ? computeRatingPercentile(v, valid) : undefined,
  )
}
