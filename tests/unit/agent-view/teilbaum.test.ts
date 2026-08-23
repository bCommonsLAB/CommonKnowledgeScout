/**
 * @fileoverview Unit-Tests: Teilbaum-Helfer des Werkbank-Details (W4).
 *
 * `isInSubtree` ist umgezogen (mcp → agent-view, Re-Export bleibt) — die
 * Pfad-Faelle wachen hier; dazu Knoten-Suche, Teilbaum-Zaehler der Fusszeile,
 * Befund-/Familien-Filter und die Bericht-Frische (nur der Befund am
 * Vorhabensordner selbst zaehlt).
 */

import { describe, it, expect } from 'vitest'
import { createGap } from '@/lib/agent-view/gap-registry'
import {
  familienImTeilbaum,
  findeKnoten,
  isInSubtree,
  istBerichtVeraltet,
  teilbaumBefunde,
  teilbaumZaehler,
} from '@/lib/agent-view/teilbaum'
import { isInSubtree as reExported } from '@/lib/mcp/coverage-view'
import type { CoverageGap, CoverageTreeNode, TwinFamilySummary } from '@/lib/agent-view/types'

function node(path: string, overrides: Partial<CoverageTreeNode> = {}): CoverageTreeNode {
  return {
    folderId: `f-${path || 'root'}`, name: path.split('/').pop() ?? '', path,
    depth: path === '' ? 0 : path.split('/').length,
    bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: false, hasBericht: false,
    sourceCount: 0, fileCount: 0, ownGaps: 0, totalGaps: 0, gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    ampel: 'gruen', children: [], ...overrides,
  }
}

function gap(path: string, folderId: string, type: CoverageGap['type'] = 'source_without_twin'): CoverageGap {
  return createGap({
    type, scope: 'folder', targetId: folderId, targetName: path, folderId, path, message: 'Test',
  })
}

function family(path: string): TwinFamilySummary {
  return { sourceId: `s-${path}`, sourceName: path, folderId: 'f-x', path, artifactCount: 1, leading: null }
}

describe('isInSubtree (umgezogen, Re-Export bleibt)', () => {
  it('matcht exakte Pfade und echte Teilbaeume, keine Namens-Praefixe', () => {
    expect(isInSubtree('Pilot/A.pdf', 'Pilot')).toBe(true)
    expect(isInSubtree('Pilot', 'Pilot')).toBe(true)
    expect(isInSubtree('Pilotprojekt/A.pdf', 'Pilot')).toBe(false)
    expect(isInSubtree('X', '')).toBe(true)
    expect(reExported).toBe(isInSubtree)
  })
})

describe('findeKnoten + teilbaumZaehler', () => {
  const baum = [
    node('', {
      sourceCount: 1, fileCount: 2,
      children: [
        node('A', { sourceCount: 2, fileCount: 3, children: [node('A/Tief', { sourceCount: 4, fileCount: 5 })] }),
        node('B'),
      ],
    }),
  ]

  it('findet Knoten in jeder Tiefe; unbekannte folderId ist null', () => {
    expect(findeKnoten(baum, 'f-A/Tief')?.path).toBe('A/Tief')
    expect(findeKnoten(baum, 'f-weg')).toBeNull()
  })

  it('summiert Quellen und Dateien ueber den ganzen Teilbaum (Fusszeile F9)', () => {
    const a = findeKnoten(baum, 'f-A')
    expect(a === null ? null : teilbaumZaehler(a)).toEqual({ quellen: 6, dateien: 8 })
  })
})

describe('teilbaumBefunde + familienImTeilbaum', () => {
  it('filtert auf den Vorhabenspfad; Familien undefined bleibt undefined (vor Welle 4 — benennen)', () => {
    const gaps = [gap('A/x.pdf', 'f-A'), gap('B/y.pdf', 'f-B')]
    expect(teilbaumBefunde(gaps, 'A').map((g) => g.path)).toEqual(['A/x.pdf'])
    expect(familienImTeilbaum([family('A/x.pdf'), family('B/y.pdf')], 'A')?.map((f) => f.path)).toEqual(['A/x.pdf'])
    expect(familienImTeilbaum(undefined, 'A')).toBeUndefined()
  })
})

describe('istBerichtVeraltet', () => {
  it('zaehlt nur bericht_veraltet am Vorhabensordner selbst, nicht im Teilbaum', () => {
    const eigene = gap('A', 'f-A', 'bericht_veraltet')
    const unterVorhaben = gap('A/Unter', 'f-A/Unter', 'bericht_veraltet')
    expect(istBerichtVeraltet([eigene, unterVorhaben], 'f-A')).toBe(true)
    expect(istBerichtVeraltet([unterVorhaben], 'f-A')).toBe(false)
    expect(istBerichtVeraltet([gap('A', 'f-A')], 'f-A')).toBe(false)
  })
})
