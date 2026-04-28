/**
 * @fileoverview Tests fuer findCommonTemplatesForSources.
 *
 * Pool-Lookup mit gemockter MongoDB-Repository-Funktion.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinsBySourceIds: vi.fn(),
}))

import { findCommonTemplatesForSources } from '@/lib/creation/composite-transformations-pool'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'

const mockGet = getShadowTwinsBySourceIds as unknown as ReturnType<typeof vi.fn>

function makeDoc(id: string, transformation: Record<string, Record<string, unknown>>) {
  return {
    libraryId: 'lib-1',
    sourceId: id,
    sourceName: `${id}.pdf`,
    parentId: 'p',
    userEmail: 'u@e.com',
    artifacts: { transformation },
    createdAt: 'x',
    updatedAt: 'x',
  }
}

describe('findCommonTemplatesForSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('liefert leeres Array bei keinen Quellen', async () => {
    const r = await findCommonTemplatesForSources({
      libraryId: 'lib-1',
      sourceIds: [],
      sourceNamesById: {},
      targetLanguage: 'de',
    })
    expect(r.templates).toEqual([])
    expect(r.sourcesWithoutShadowTwin).toBe(0)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('aggregiert Templates ueber mehrere Quellen mit gleicher Sprache', async () => {
    mockGet.mockResolvedValue(
      new Map([
        ['s1', makeDoc('s1', {
          'tmpl-a': { de: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } },
          'tmpl-b': { de: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } },
        })],
        ['s2', makeDoc('s2', {
          'tmpl-a': { de: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } },
        })],
      ]),
    )

    const r = await findCommonTemplatesForSources({
      libraryId: 'lib-1',
      sourceIds: ['s1', 's2'],
      sourceNamesById: { s1: 'a.pdf', s2: 'b.pdf' },
      targetLanguage: 'de',
    })

    // tmpl-a hat beide Quellen → steht oben (Sortierung nach coveredSources.length)
    expect(r.templates[0].templateName).toBe('tmpl-a')
    expect(r.templates[0].coveredSources).toEqual(['a.pdf', 'b.pdf'])
    expect(r.templates[0].missingSources).toEqual([])

    expect(r.templates[1].templateName).toBe('tmpl-b')
    expect(r.templates[1].coveredSources).toEqual(['a.pdf'])
    expect(r.templates[1].missingSources).toEqual(['b.pdf'])
  })

  it('filtert Templates aus, die die Zielsprache nicht haben', async () => {
    mockGet.mockResolvedValue(
      new Map([
        ['s1', makeDoc('s1', {
          'tmpl-a': { en: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } },
        })],
      ]),
    )

    const r = await findCommonTemplatesForSources({
      libraryId: 'lib-1',
      sourceIds: ['s1'],
      sourceNamesById: { s1: 'a.pdf' },
      targetLanguage: 'de',
    })

    expect(r.templates).toEqual([])
  })

  it('zaehlt Quellen ohne Shadow-Twin separat', async () => {
    mockGet.mockResolvedValue(new Map())

    const r = await findCommonTemplatesForSources({
      libraryId: 'lib-1',
      sourceIds: ['s1', 's2'],
      sourceNamesById: { s1: 'a.pdf', s2: 'b.pdf' },
      targetLanguage: 'de',
    })

    expect(r.templates).toEqual([])
    expect(r.sourcesWithoutShadowTwin).toBe(2)
  })

  it('sortiert bei gleicher Coverage alphabetisch', async () => {
    mockGet.mockResolvedValue(
      new Map([
        ['s1', makeDoc('s1', {
          'zzz-template': { de: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } },
          'aaa-template': { de: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } },
        })],
      ]),
    )

    const r = await findCommonTemplatesForSources({
      libraryId: 'lib-1',
      sourceIds: ['s1'],
      sourceNamesById: { s1: 'a.pdf' },
      targetLanguage: 'de',
    })

    expect(r.templates.map(t => t.templateName)).toEqual(['aaa-template', 'zzz-template'])
  })
})
