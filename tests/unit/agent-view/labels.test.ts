import { describe, it, expect } from 'vitest'
import { actorLabel, actorSummary, BOARD_COLUMNS, gapCountLabel, gapLabel, standLabel } from '@/lib/agent-view/labels'
import { GAP_REGISTRY } from '@/lib/agent-view/gap-registry'
import type { CoverageGapType } from '@/lib/agent-view/types'

describe('agent-view labels', () => {
  it('beschriftet jeden Gap-Typ der Registry', () => {
    for (const type of Object.keys(GAP_REGISTRY) as CoverageGapType[]) {
      expect(gapLabel(type).length).toBeGreaterThan(0)
    }
  })

  it('beschriftet Akteure und Staende, undeklariert inklusive', () => {
    expect(actorLabel('knowledgescout')).toBe('KnowledgeScout')
    expect(standLabel('abgenommen')).toBe('Abgenommen')
    expect(standLabel(null)).toBe('Ohne erklaerten Stand')
  })

  it('haelt sechs Board-Spalten: fuenf Staende plus undeklariert', () => {
    expect(BOARD_COLUMNS).toHaveLength(6)
    expect(BOARD_COLUMNS[0]).toBe('ungesichtet')
    expect(BOARD_COLUMNS[5]).toBeNull()
  })

  it('zaehlt Befunde grammatikalisch korrekt', () => {
    expect(gapCountLabel(0)).toBe('ohne Befund')
    expect(gapCountLabel(1)).toBe('1 Befund')
    expect(gapCountLabel(4)).toBe('4 Befunde')
  })

  it('fasst die Akteur-Verteilung zusammen', () => {
    expect(actorSummary({ mensch: 1, cowork: 2, knowledgescout: 0 })).toBe('Mensch 1 · Cowork 2')
    expect(actorSummary({ mensch: 0, cowork: 0, knowledgescout: 0 })).toBe('keine offenen Todos')
  })
})
