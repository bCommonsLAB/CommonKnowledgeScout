/**
 * S1 — Transformationen einer Vorlage mit Projektion lesen: Pipeline-Form,
 * Normalisierung der Zeilen, laute Fehler bei unbrauchbaren Namen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ aggregate: vi.fn() }))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinCollection: async () => ({ aggregate: h.aggregate }),
}))

import { findeTransformationenNachVorlage } from '@/lib/repositories/shadow-twin-transformationen'

const FIXTURE = [
  {
    sourceId: 's1', sourceName: '2026-10-29 Code BigHop.md', parentId: 'p1',
    frontmatter: { title: 'BigHop', teaser: 'T', werkzeug: 'claude-code', date: '2026-10-29' },
    updatedAt: '2026-11-05T12:14:07.047Z',
  },
  // Record ohne Frontmatter und ohne updatedAt (aelterer Bestand)
  { sourceId: 's2', sourceName: 'alt.md', parentId: 'p2' },
  // Frontmatter in unbrauchbarer Form
  { sourceId: 's3', sourceName: 'kaputt.md', parentId: 'p3', frontmatter: 'kein Objekt', updatedAt: 7 },
]

beforeEach(() => {
  h.aggregate.mockReset().mockReturnValue({ toArray: async () => FIXTURE })
})

describe('findeTransformationenNachVorlage', () => {
  it('matcht auf den Vorlagen-Pfad, projiziert nur das Noetige und sortiert nach sourceName', async () => {
    const zeilen = await findeTransformationenNachVorlage({ libraryId: 'lib', template: 'chatverlauf-de', language: 'de' })
    const [pipeline] = h.aggregate.mock.calls[0]
    expect(pipeline[0]).toEqual({ $match: { libraryId: 'lib', 'artifacts.transformation.chatverlauf-de.de': { $exists: true } } })
    expect(pipeline[1]).toEqual({
      $project: {
        _id: 0, sourceId: 1, sourceName: 1, parentId: 1,
        frontmatter: '$artifacts.transformation.chatverlauf-de.de.frontmatter',
        updatedAt: '$artifacts.transformation.chatverlauf-de.de.updatedAt',
      },
    })
    expect(pipeline[2]).toEqual({ $sort: { sourceName: 1 } })
    expect(zeilen).toEqual([
      { sourceId: 's1', sourceName: '2026-10-29 Code BigHop.md', parentId: 'p1', frontmatter: FIXTURE[0].frontmatter, updatedAt: '2026-11-05T12:14:07.047Z' },
      { sourceId: 's2', sourceName: 'alt.md', parentId: 'p2', frontmatter: null, updatedAt: null },
      { sourceId: 's3', sourceName: 'kaputt.md', parentId: 'p3', frontmatter: null, updatedAt: null },
    ])
  })

  it('wirft bei Vorlagen-/Sprachnamen, die keinen Mongo-Feldpfad bilden, und bei Dokumenten ohne sourceId', async () => {
    await expect(findeTransformationenNachVorlage({ libraryId: 'lib', template: 'a.b', language: 'de' })).rejects.toThrow(/Vorlage "a\.b"/)
    await expect(findeTransformationenNachVorlage({ libraryId: 'lib', template: 'x', language: '' })).rejects.toThrow(/Sprache fehlt/)
    expect(h.aggregate).not.toHaveBeenCalled()
    h.aggregate.mockReturnValue({ toArray: async () => [{ sourceName: 'ohne-id.md' }] })
    await expect(findeTransformationenNachVorlage({ libraryId: 'lib', template: 'x', language: 'de' })).rejects.toThrow(/ohne sourceId/)
  })
})
