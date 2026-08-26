import { describe, it, expect } from 'vitest'
import { checkStandWiderspruch, widerlegendeTypen } from '@/lib/agent-view/stand-widerspruch'
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
      subtreeGapTypes: ['twin_flagged', 'source_without_twin'],
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

  // Befund 24.08.2026 (Live-Lauf ueber die Bruecke): Ein Ordner auf
  // „berichtet" mit 28 offenen `twin_flagged` bekam einen Widerspruch —
  // obwohl genau das der Zustand ist, auf den die Abnahme wartet.
  describe('der Zyklus-Schritt entscheidet', () => {
    it('„berichtet" wird NICHT von Schritt-4-Befunden widerlegt (twin_flagged)', () => {
      const berichtet = node({ bearbeitungsstand: 'berichtet' })
      const gap = checkStandWiderspruch({
        node: berichtet, newestChangeInSubtree: null, subtreeGapTypes: ['twin_flagged'],
      })
      expect(gap).toBeNull()
    })

    it('„abgenommen" wird sehr wohl von Schritt-4-Befunden widerlegt', () => {
      const gap = checkStandWiderspruch({
        node: node(), newestChangeInSubtree: null, subtreeGapTypes: ['twin_flagged'],
      })
      expect(gap?.type).toBe('stand_widerspruch')
      expect(gap?.detail).toContain('twin_flagged')
    })

    it('„berichtet" wird von frueheren Schritten weiterhin widerlegt', () => {
      const berichtet = node({ bearbeitungsstand: 'berichtet' })
      const gap = checkStandWiderspruch({
        node: berichtet, newestChangeInSubtree: null, subtreeGapTypes: ['source_without_twin'],
      })
      expect(gap?.zyklusSchritt).toBe(1)
    })

    it('nennt im Detail nur die widerlegenden Typen, nicht die spaeteren', () => {
      const berichtet = node({ bearbeitungsstand: 'berichtet' })
      const gap = checkStandWiderspruch({
        node: berichtet, newestChangeInSubtree: null,
        subtreeGapTypes: ['twin_flagged', 'report_missing'],
      })
      expect(gap?.detail).toContain('report_missing')
      expect(gap?.detail).not.toContain('twin_flagged')
    })

    it('der Aenderungs-Verdacht bleibt unabhaengig vom Schritt bestehen', () => {
      const berichtet = node({ bearbeitungsstand: 'berichtet' })
      const gap = checkStandWiderspruch({
        node: berichtet,
        newestChangeInSubtree: '2026-08-20T10:00:00.000Z',
        subtreeGapTypes: ['twin_flagged'],
      })
      expect(gap?.detail).toContain('Pruefauftrag')
    })
  })

  describe('widerlegendeTypen', () => {
    it('schneidet je Stand bei dessen behauptetem Schritt ab', () => {
      const alle = ['source_without_twin', 'index_missing', 'report_missing', 'twin_flagged'] as const
      expect(widerlegendeTypen(alle, 'erschlossen')).toEqual(['source_without_twin'])
      expect(widerlegendeTypen(alle, 'strukturiert')).toEqual(['source_without_twin', 'index_missing'])
      expect(widerlegendeTypen(alle, 'berichtet')).toEqual(['source_without_twin', 'index_missing', 'report_missing'])
      expect(widerlegendeTypen(alle, 'abgenommen')).toEqual([...alle])
    })
  })
})
