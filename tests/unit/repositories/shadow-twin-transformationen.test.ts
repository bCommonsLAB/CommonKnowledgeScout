/**
 * S1/S1b — Transformationen einer Vorlage mit Projektion lesen: Pipeline-Form,
 * Normalisierung der Zeilen (samt Beleg-Kopf-Merker), laute Fehler bei
 * unbrauchbaren Namen; Merker setzen nur an vorhandenen Twins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ aggregate: vi.fn(), updateOne: vi.fn() }))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinCollection: async () => ({ aggregate: h.aggregate, updateOne: h.updateOne }),
}))

import { findeTransformationenNachVorlage, setzeQuellFrontmatter } from '@/lib/repositories/shadow-twin-transformationen'

const FIXTURE = [
  {
    sourceId: 's1', sourceName: '2026-10-29 Code BigHop.md', parentId: 'p1',
    frontmatter: { title: 'BigHop', teaser: 'T', werkzeug: 'claude-code', date: '2026-10-29' },
    updatedAt: '2026-11-05T12:14:07.047Z',
    sourceFrontmatter: { fields: { vorhaben: ['24.03 bcoop'] }, sourceModifiedAt: '2026-11-01T00:00:00Z', readAt: '2026-11-09T00:00:00Z' },
  },
  // Record ohne Frontmatter, ohne updatedAt, ohne Merker (aelterer Bestand)
  { sourceId: 's2', sourceName: 'alt.md', parentId: 'p2' },
  // Frontmatter und Merker in unbrauchbarer Form
  { sourceId: 's3', sourceName: 'kaputt.md', parentId: 'p3', frontmatter: 'kein Objekt', updatedAt: 7, sourceFrontmatter: { fields: 'x' } },
]

beforeEach(() => {
  h.aggregate.mockReset().mockReturnValue({ toArray: async () => FIXTURE })
  h.updateOne.mockReset().mockResolvedValue({ matchedCount: 1 })
})

describe('findeTransformationenNachVorlage', () => {
  it('matcht auf den Vorlagen-Pfad, projiziert nur das Noetige und sortiert nach sourceName', async () => {
    const zeilen = await findeTransformationenNachVorlage({ libraryId: 'lib', template: 'chatverlauf-de', language: 'de' })
    const [pipeline] = h.aggregate.mock.calls[0]
    expect(pipeline[0]).toEqual({ $match: { libraryId: 'lib', 'artifacts.transformation.chatverlauf-de.de': { $exists: true } } })
    expect(pipeline[1]).toEqual({
      $project: {
        _id: 0, sourceId: 1, sourceName: 1, parentId: 1, sourceFrontmatter: 1,
        frontmatter: '$artifacts.transformation.chatverlauf-de.de.frontmatter',
        updatedAt: '$artifacts.transformation.chatverlauf-de.de.updatedAt',
      },
    })
    expect(pipeline[2]).toEqual({ $sort: { sourceName: 1 } })
    expect(zeilen).toEqual([
      {
        sourceId: 's1', sourceName: '2026-10-29 Code BigHop.md', parentId: 'p1', frontmatter: FIXTURE[0].frontmatter,
        updatedAt: '2026-11-05T12:14:07.047Z', sourceFrontmatter: { fields: { vorhaben: ['24.03 bcoop'] }, sourceModifiedAt: '2026-11-01T00:00:00Z' },
      },
      { sourceId: 's2', sourceName: 'alt.md', parentId: 'p2', frontmatter: null, updatedAt: null, sourceFrontmatter: null },
      { sourceId: 's3', sourceName: 'kaputt.md', parentId: 'p3', frontmatter: null, updatedAt: null, sourceFrontmatter: null },
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

describe('setzeQuellFrontmatter', () => {
  it('setzt Merker und updatedAt am vorhandenen Twin; fehlender Twin ist ein Fehler', async () => {
    await setzeQuellFrontmatter({ libraryId: 'lib', sourceId: 's1', fields: { vorhaben: ['a'] }, sourceModifiedAt: '2026-11-01T00:00:00Z' })
    const [filter, update] = h.updateOne.mock.calls[0]
    expect(filter).toEqual({ libraryId: 'lib', sourceId: 's1' })
    expect(update.$set.sourceFrontmatter).toMatchObject({ fields: { vorhaben: ['a'] }, sourceModifiedAt: '2026-11-01T00:00:00Z' })
    expect(typeof update.$set.sourceFrontmatter.readAt).toBe('string')
    expect(typeof update.$set.updatedAt).toBe('string')
    h.updateOne.mockResolvedValue({ matchedCount: 0 })
    await expect(setzeQuellFrontmatter({ libraryId: 'lib', sourceId: 'fehlt', fields: {}, sourceModifiedAt: null })).rejects.toThrow(/kein Twin fuer fehlt/)
    await expect(setzeQuellFrontmatter({ libraryId: 'lib', sourceId: '', fields: {}, sourceModifiedAt: null })).rejects.toThrow(/sourceId fehlt/)
  })
})
