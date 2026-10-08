/**
 * Welle E — Sammeldateien, die eine Quelle enthalten: ueberholt, wenn eine
 * Transformation aelter ist als revised_at der Quelle; ohne Transformation
 * benannt; Loader-Aufruf ohne Quellen-Ids wirft.
 */
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({
  composites: [] as unknown[],
  quelle: null as Record<string, unknown> | null,
  gesetzt: [] as unknown[],
}))
vi.mock('@/lib/repositories/shadow-twin-sammeldatei', () => ({
  findeSammeldateienMitQuelle: async () => h.composites,
  setzeSammeldateiQuellen: async (args: unknown) => { h.gesetzt.push(args) },
}))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinsBySourceIds: async () => new Map(h.quelle ? [['q1', h.quelle]] : []),
  readTranscriptRecord: (doc: { artifacts?: { transcript?: unknown } }) => doc.artifacts?.transcript ?? null,
}))

import {
  abhaengigeSammeldateien, korrekturStandDerQuelle, merkeSammeldateiQuellen, transformationenGegenStand,
} from '@/lib/shadow-twin/sammeldatei-abhaengigkeit'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

const composite = (name: string, standTransformation: string | null) => ({
  sourceId: `c-${name}`, sourceName: name, parentId: 'ordner', libraryId: 'lib', userEmail: 'o@x',
  artifacts: standTransformation
    ? { transformation: { vortrag: { de: { markdown: '# x', createdAt: standTransformation, updatedAt: standTransformation } } } }
    : {},
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
}) as unknown as ShadowTwinDocument

describe('transformationenGegenStand', () => {
  it('markiert Transformationen aelter als revised_at als ueberholt', () => {
    const z = transformationenGegenStand(composite('02', '2026-10-05T10:00:00.000Z'), '2026-10-06T00:00:00.000Z')
    expect(z).toEqual([{ template: 'vortrag', sprache: 'de', stand: '2026-10-05T10:00:00.000Z', ueberholt: true }])
    expect(transformationenGegenStand(composite('02', '2026-10-07T00:00:00.000Z'), '2026-10-06T00:00:00.000Z')[0].ueberholt).toBe(false)
    expect(transformationenGegenStand(composite('02', '2026-10-05T10:00:00.000Z'), null)[0].ueberholt).toBe(false)
  })
})

describe('abhaengigeSammeldateien', () => {
  it('liest revised_at der Quelle und beurteilt jede Sammeldatei', async () => {
    h.quelle = { artifacts: { transcript: { markdown: '---\nrevised_at: 2026-10-06T00:00:00.000Z\n---\nText' } } }
    h.composites = [composite('02', '2026-10-05T10:00:00.000Z'), composite('03', '2026-10-07T00:00:00.000Z'), composite('04', null)]
    expect(await korrekturStandDerQuelle('lib', 'q1')).toBe('2026-10-06T00:00:00.000Z')
    const r = await abhaengigeSammeldateien({ libraryId: 'lib', sourceId: 'q1' })
    expect(r.map((a) => [a.sourceName, a.ueberholt, a.ohneTransformation])).toEqual([['02', true, false], ['03', false, false], ['04', false, true]])
  })

  it('ohne Korrektur ist nichts ueberholt', async () => {
    h.quelle = { artifacts: { transcript: { markdown: '---\ntitle: x\n---\nText' } } }
    h.composites = [composite('02', '2026-10-05T10:00:00.000Z')]
    expect((await abhaengigeSammeldateien({ libraryId: 'lib', sourceId: 'q1' }))[0].ueberholt).toBe(false)
  })
})

describe('merkeSammeldateiQuellen', () => {
  it('reicht die Quellen-Ids an das Repository und wirft ohne Liste', async () => {
    await merkeSammeldateiQuellen({ libraryId: 'lib', userEmail: 'o@x', sourceId: 'c', sourceName: 'S.md', parentId: 'p', quellenIds: ['a', 'b'] })
    expect(h.gesetzt).toHaveLength(1)
    await expect(merkeSammeldateiQuellen({ libraryId: 'lib', userEmail: 'o@x', sourceId: 'c', sourceName: 'S.md', parentId: 'p', quellenIds: undefined as unknown as string[] }))
      .rejects.toThrow(/quellenIds fehlen/)
  })
})
