/**
 * @fileoverview Synergiebereinigte Summe ueber Aehnlichkeits-Kanten.
 *
 * @description
 * Naive Summen ueberschaetzen, wenn sich Massnahmen Wirkung/Kosten teilen
 * ("Doppelzaehlung/Policy Overlap", UNEP Emissions Gap Report, ICAT Policy
 * Guidance). Naeherung mit den vorhandenen Embedding-Kanten per
 * Greedy-Abzinsung (verwandt mit Maximal Marginal Relevance, Carbonell &
 * Goldstein 1998):
 *
 * 1. Items absteigend nach Wert sortieren; das groesste zaehlt voll.
 * 2. Jedes weitere zaehlt mit Abschlag fuer Aehnlichkeit zu bereits
 *    gezaehlten Nachbarn: Beitrag_k = Wert_k * Prod_j (1 - alpha * s_kj).
 * 3. alpha in [0..1] steuert, wie stark thematische Aehnlichkeit als
 *    Wirkungs-Ueberlappung interpretiert wird (0 = naive Summe).
 *
 * WICHTIGE GRENZE (im UI transparent machen): Die Aehnlichkeit stammt aus
 * Text-Embeddings — sie misst THEMATISCHE Naehe, nicht kausale Ueberlappung.
 * Ergebnis daher immer als Spanne kommunizieren (naiv = Obergrenze,
 * bereinigt = konservative Schaetzung), nie als "die Summe".
 *
 * @usedIn
 * - src/components/library/gallery/graph/graph-sums-panel.tsx
 * - tests/unit/gallery/synergy-sum.test.ts
 */

/** Ein Dokument mit (optionalem) Zahlenwert des Summenfeldes. */
export interface SynergyItem {
  id: string
  /**
   * Wert des Summenfeldes. `undefined`/`null` = "ohne Angabe" — wird
   * NICHT als 0 gezaehlt, sondern ausgelassen und in `missing` gemeldet
   * (no-silent-fallbacks).
   */
  value: number | null | undefined
}

/** Ungerichtete Aehnlichkeits-Kante (weight = Similarity-Score). */
export interface SynergyEdge {
  source: string
  target: string
  weight: number
}

export interface SynergyAdjustedSumResult {
  /** Ungewichtete Summe aller vorhandenen Werte (Obergrenze). */
  naiveSum: number
  /** Greedy-abgezinste Summe (konservative Schaetzung, <= naiveSum). */
  adjustedSum: number
  /** Anzahl Items mit Wert (in beide Summen eingeflossen). */
  counted: number
  /** Anzahl Items ohne Wert ("X ohne Angabe"). */
  missing: number
}

/**
 * Berechnet naive und synergiebereinigte Summe ueber die Items.
 * Pure Funktion, deterministisch (Ties werden per id stabil sortiert).
 *
 * @throws Error bei alpha ausserhalb [0..1] (kein Silent-Clamp).
 */
export function computeSynergyAdjustedSum(
  items: SynergyItem[],
  edges: SynergyEdge[],
  alpha: number,
): SynergyAdjustedSumResult {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new Error(`computeSynergyAdjustedSum: alpha muss in [0..1] liegen (erhalten: ${alpha})`)
  }

  const valued: Array<{ id: string; value: number }> = []
  let missing = 0
  for (const item of items) {
    if (typeof item.value === 'number' && Number.isFinite(item.value)) {
      valued.push({ id: item.id, value: item.value })
    } else {
      missing += 1
    }
  }

  // Adjazenz: pro Paar staerkstes Gewicht behalten (Kanten koennen aus
  // Chunk-Laeufen doppelt kommen), Selbstkanten ignorieren, Gewicht auf
  // [0..1] begrenzen (Scores >1 wuerden negative Faktoren erzeugen).
  const neighborWeight = new Map<string, Map<string, number>>()
  const setEdge = (a: string, b: string, w: number) => {
    let m = neighborWeight.get(a)
    if (!m) {
      m = new Map<string, number>()
      neighborWeight.set(a, m)
    }
    const prev = m.get(b)
    if (prev === undefined || w > prev) m.set(b, w)
  }
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    if (!Number.isFinite(edge.weight) || edge.weight <= 0) continue
    const w = Math.min(1, edge.weight)
    setEdge(edge.source, edge.target, w)
    setEdge(edge.target, edge.source, w)
  }

  // Greedy: absteigend nach Wert (Ties stabil per id), groesstes zaehlt voll.
  const sorted = [...valued].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
  const countedIds = new Set<string>()
  let naiveSum = 0
  let adjustedSum = 0
  for (const { id, value } of sorted) {
    naiveSum += value
    let factor = 1
    const neighbors = neighborWeight.get(id)
    if (neighbors && alpha > 0) {
      for (const [otherId, weight] of neighbors) {
        if (countedIds.has(otherId)) factor *= 1 - alpha * weight
      }
    }
    adjustedSum += value * factor
    countedIds.add(id)
  }

  return { naiveSum, adjustedSum, counted: valued.length, missing }
}
