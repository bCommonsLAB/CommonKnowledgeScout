import { describe, it, expect } from 'vitest'
import { checkStandWiderspruch } from '@/lib/agent-view/stand-widerspruch'
import type { Bearbeitungsstand, CoverageTreeNode } from '@/lib/agent-view/types'

function node(overrides: Partial<CoverageTreeNode> = {}): CoverageTreeNode {
  return {
    folderId: 'f1',
    name: '25.01 Pilot',
    path: '25.01 Pilot',
    depth: 1,
    bearbeitungsstand: 'abgenommen' as Bearbeitungsstand,
    bearbeitungsstandSeit: '2026-08-18T23:59:59.999Z',
    hasIndex: true,
    hasBericht: true,
    sourceCount: 2,
    fileCount: 4,
    ownGaps: 0,
    totalGaps: 0,
    gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 },
    ampel: 'gruen',
    children: [],
    ...overrides,
  }
}

describe('stand-widerspruch', () => {
  it('meldet den Widerspruch bei Aenderung nach bearbeitungsstand_seit (Rueckfall-Test, Akzeptanzkriterium 8)', () => {
    const gap = checkStandWiderspruch({ node: node(), newestChangeInSubtree: '2026-08-20T10:00:00.000Z', subtreeGapTypes: [] })
    expect(gap?.type).toBe('stand_widerspruch')
    expect(gap?.detail).toContain('Pruefauftrag')
  })

  it('meldet nichts, wenn nichts seit dem Stand geaendert wurde (Negativfall)', () => {
    const gap = checkStandWiderspruch({ node: node(), newestChangeInSubtree: '2026-08-17T10:00:00.000Z', subtreeGapTypes: [] })
    expect(gap).toBeNull()
  })

  it('meldet offene Befunde im Teilbaum und routet auf den zurueckgefallenen Schritt', () => {
    const gap = checkStandWiderspruch({
      node: node(),
      newestChangeInSubtree: null,
      subtreeGapTypes: ['twin_unverified', 'source_without_twin'],
    })
    // Fruehester betroffener Schritt gewinnt: source_without_twin (Schritt 1, KS).
    expect(gap?.zyklusSchritt).toBe(1)
    expect(gap?.actor).toBe('knowledgescout')
  })

  it('prueft Staende unterhalb von „berichtet" gar nicht erst', () => {
    const offen = node({ bearbeitungsstand: 'erschlossen' })
    expect(checkStandWiderspruch({ node: offen, newestChangeInSubtree: '2026-08-20T10:00:00.000Z', subtreeGapTypes: ['conflict'] })).toBeNull()
  })

  it('ignoriert einen bereits gemeldeten Widerspruch als eigenen Ausloeser', () => {
    const gap = checkStandWiderspruch({ node: node(), newestChangeInSubtree: null, subtreeGapTypes: ['stand_widerspruch'] })
    expect(gap).toBeNull()
  })
})
