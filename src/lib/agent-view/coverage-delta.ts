/**
 * @fileoverview Delta zwischen zwei Coverage-Scans (Pilot-Wunschliste D1).
 *
 * @description
 * Die Gesamtzahl der Befunde misst keinen Fortschritt — Befunde WANDERN
 * (Mensch → Pipeline → Verifikation), die Zahl bleibt gleich. Das Delta
 * benennt, was seit dem letzten Scan ERLEDIGT und was NEU ist, statt es den
 * Menschen errechnen zu lassen.
 *
 * Verglichen wird nur bei gleichem Scope; sonst (oder beim ersten Scan, oder
 * wenn der vorherige Report gekappt war) sagt `hinweis` ausdruecklich, warum
 * es kein Delta gibt — nie ein stilles 0/0.
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import type { CoverageGap, CoverageGapType, CoverageReport } from './types'

export interface CoverageDelta {
  /** Zeitpunkt des Vergleichs-Scans (der vorherige Report). */
  vorherigerScan: string
  erledigt: number
  neu: number
  erledigtNachTyp: Partial<Record<CoverageGapType, number>>
  neuNachTyp: Partial<Record<CoverageGapType, number>>
}

export interface CoverageDeltaResult {
  delta: CoverageDelta | null
  /** Warum es kein Delta gibt (erster Scan, anderer Scope, gekappter Vorlauf). */
  hinweis: string | null
}

/** Identitaet eines Befunds ueber Scans hinweg (detail wandelt sich, Typ+Ort nicht). */
function gapKey(gap: CoverageGap): string {
  return `${gap.type}|${gap.path}|${gap.targetName}`
}

function countByType(gaps: readonly CoverageGap[]): Partial<Record<CoverageGapType, number>> {
  const counts: Partial<Record<CoverageGapType, number>> = {}
  for (const gap of gaps) counts[gap.type] = (counts[gap.type] ?? 0) + 1
  return counts
}

export function computeCoverageDelta(args: {
  previous: { report: CoverageReport; generatedAt: string; gapsTruncated: boolean } | null
  next: CoverageReport
}): CoverageDeltaResult {
  const { previous, next } = args
  if (previous === null) {
    return { delta: null, hinweis: 'Erster Scan — kein Vergleich moeglich' }
  }
  if (previous.report.scope.folderId !== next.scope.folderId) {
    return { delta: null, hinweis: 'Anderer Scan-Scope als zuvor — kein Vergleich' }
  }
  if (previous.gapsTruncated) {
    return { delta: null, hinweis: 'Vorheriger Report war gekappt — Vergleich waere unvollstaendig' }
  }

  const previousKeys = new Set(previous.report.gaps.map(gapKey))
  const nextKeys = new Set(next.gaps.map(gapKey))
  const erledigt = previous.report.gaps.filter((gap) => !nextKeys.has(gapKey(gap)))
  const neu = next.gaps.filter((gap) => !previousKeys.has(gapKey(gap)))

  return {
    delta: {
      vorherigerScan: previous.generatedAt,
      erledigt: erledigt.length,
      neu: neu.length,
      erledigtNachTyp: countByType(erledigt),
      neuNachTyp: countByType(neu),
    },
    hinweis: null,
  }
}
