/**
 * @fileoverview Tests fuer die Transformations-Erweiterung von composite-transcript.
 *
 * Geprueft werden:
 *  A) buildCompositeReference mit transformationTemplateName setzt Suffix
 *     in _source_files und Quellen-Wikilinks.
 *  B) resolveCompositeTranscript laed bei Schraegstrich-Suffix die
 *     Transformation statt eines Transcripts.
 *  C) Fehlende Transformation → unresolvedSources.
 *
 * Mocks: Storage-Provider, MongoDB-Repo, Aggregations-Service.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── Mocks (vor Import des Moduls) ──────────────────────────────────────────
vi.mock('@/lib/repositories/shadow-twin-repo', () => {
  return {
    getShadowTwinsBySourceIds: vi.fn().mockResolvedValue(new Map()),
    getShadowTwinArtifact: vi.fn(),
    toArtifactKey: (args: { sourceId: string; kind: string; targetLanguage: string; templateName?: string }) => ({
      ...args,
    }),
  }
})

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn(),
}))

vi.mock('@/lib/media/aggregated-media-service', () => ({
  buildAggregatedMediaForSources: vi.fn().mockResolvedValue({
    mediaFiles: [],
    pdfSections: [],
    otherExtracted: [],
  }),
  extractCanonicalImageNameByBlobNameFromMarkdown: () => new Map(),
  extractImageLikeNamesFromMarkdown: () => [],
}))

import {
  buildCompositeReference,
  resolveCompositeTranscript,
} from '@/lib/creation/composite-transcript'
import {
  getShadowTwinsBySourceIds,
  getShadowTwinArtifact,
} from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'

const mockGetMany = getShadowTwinsBySourceIds as unknown as ReturnType<typeof vi.fn>
const mockGetOne = getShadowTwinArtifact as unknown as ReturnType<typeof vi.fn>
const mockProvider = getServerProvider as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMany.mockResolvedValue(new Map())
})

// ─── A) Build mit transformationTemplateName ───────────────────────────────
describe('buildCompositeReference + transformationTemplateName', () => {
  it('haengt /templateName-Suffix an _source_files und Quellen-Wikilinks an', async () => {
    const result = await buildCompositeReference({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      sourceItems: [
        { id: 's1', name: 'a.pdf', parentId: 'p' },
        { id: 's2', name: 'b.pdf', parentId: 'p' },
      ],
      transformationTemplateName: 'tmpl',
    })

    expect(result.markdown).toContain('"a.pdf/tmpl"')
    expect(result.markdown).toContain('"b.pdf/tmpl"')
    expect(result.markdown).toContain('- [[a.pdf/tmpl]]')
    expect(result.markdown).toContain('- [[b.pdf/tmpl]]')
    expect(result.markdown).toContain('# Sammel-Transformationen')
    // sourceFileNames bleiben ohne Suffix (fuer Anzeige).
    expect(result.sourceFileNames).toEqual(['a.pdf', 'b.pdf'])
  })

  it('Markdown-Quellen bekommen KEIN Suffix (haben kein Template)', async () => {
    const result = await buildCompositeReference({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      sourceItems: [
        { id: 's1', name: 'a.pdf', parentId: 'p' },
        { id: 's2', name: 'notes.md', parentId: 'p' },
      ],
      transformationTemplateName: 'tmpl',
    })

    expect(result.markdown).toContain('"a.pdf/tmpl"')
    // .md-Quellen ohne Suffix:
    expect(result.markdown).toContain('"notes.md"')
    expect(result.markdown).not.toContain('"notes.md/tmpl"')
  })

  it('Default-Modus (ohne transformationTemplateName) bleibt unveraendert', async () => {
    const result = await buildCompositeReference({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      sourceItems: [{ id: 's1', name: 'a.pdf', parentId: 'p' }],
    })

    expect(result.markdown).toContain('"a.pdf"')
    expect(result.markdown).not.toContain('/')
    expect(result.markdown).toContain('# Sammel-Transkript')
  })

  it('meldet missingTranscripts, wenn Quelle die Transformation nicht hat', async () => {
    mockGetMany.mockResolvedValue(new Map([
      ['s1', {
        libraryId: 'lib-1', sourceId: 's1', sourceName: 'a.pdf', parentId: 'p',
        userEmail: 'u@e.com',
        artifacts: { transformation: { tmpl: { de: { markdown: 'm', createdAt: 'x', updatedAt: 'x' } } } },
        createdAt: 'x', updatedAt: 'x',
      }],
      // s2 hat KEINE Transformation
      ['s2', {
        libraryId: 'lib-1', sourceId: 's2', sourceName: 'b.pdf', parentId: 'p',
        userEmail: 'u@e.com',
        artifacts: {},
        createdAt: 'x', updatedAt: 'x',
      }],
    ]))

    const result = await buildCompositeReference({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      sourceItems: [
        { id: 's1', name: 'a.pdf', parentId: 'p' },
        { id: 's2', name: 'b.pdf', parentId: 'p' },
      ],
      transformationTemplateName: 'tmpl',
    })

    expect(result.missingTranscripts).toEqual(['b.pdf'])
  })
})

// ─── B/C) Resolver mit Schraegstrich-Suffix ────────────────────────────────
describe('resolveCompositeTranscript mit Suffix', () => {
  it('laedt Transformation statt Transcript bei Schraegstrich-Suffix', async () => {
    mockProvider.mockResolvedValue({
      listItemsById: vi.fn().mockResolvedValue([
        { id: 's1', type: 'file', metadata: { name: 'a.pdf' } },
      ]),
      getBinary: vi.fn(),
    })
    mockGetOne.mockResolvedValue({
      markdown: '# Transformation Markdown\nInhalt',
      createdAt: 'x', updatedAt: 'x',
    })

    const md = [
      '---',
      '_source_files: ["a.pdf/tmpl"]',
      'kind: composite-transcript',
      '---',
      '# x',
    ].join('\n')

    const r = await resolveCompositeTranscript({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      compositeMarkdown: md,
      parentId: 'p',
    })

    // Wurde Transformation aufgerufen, NICHT Transcript:
    const lastCall = mockGetOne.mock.calls[0]?.[0]
    expect(lastCall?.artifactKey?.kind).toBe('transformation')
    expect(lastCall?.artifactKey?.templateName).toBe('tmpl')
    expect(lastCall?.artifactKey?.targetLanguage).toBe('de')

    // Geflachter Markdown enthaelt den Inhalt der Transformation:
    expect(r.markdown).toContain('Transformation Markdown')
    expect(r.unresolvedSources).toEqual([])
  })

  it('meldet fehlende Transformation als unresolved (raw inkl. Suffix)', async () => {
    mockProvider.mockResolvedValue({
      listItemsById: vi.fn().mockResolvedValue([
        { id: 's1', type: 'file', metadata: { name: 'a.pdf' } },
      ]),
      getBinary: vi.fn(),
    })
    mockGetOne.mockResolvedValue(null)

    const md = [
      '---',
      '_source_files: ["a.pdf/tmpl"]',
      'kind: composite-transcript',
      '---',
      '',
    ].join('\n')

    const r = await resolveCompositeTranscript({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      compositeMarkdown: md,
      parentId: 'p',
    })

    expect(r.unresolvedSources).toEqual(['a.pdf/tmpl'])
  })

  it('Default-Pfad (ohne Suffix) bleibt unveraendert: laedt Transcript', async () => {
    mockProvider.mockResolvedValue({
      listItemsById: vi.fn().mockResolvedValue([
        { id: 's1', type: 'file', metadata: { name: 'a.pdf' } },
      ]),
      getBinary: vi.fn(),
    })
    mockGetOne.mockResolvedValue({
      markdown: '# Transcript Markdown',
      createdAt: 'x', updatedAt: 'x',
    })

    const md = [
      '---',
      '_source_files: ["a.pdf"]',
      'kind: composite-transcript',
      '---',
      '',
    ].join('\n')

    const r = await resolveCompositeTranscript({
      libraryId: 'lib-1',
      userEmail: 'u@e.com',
      targetLanguage: 'de',
      compositeMarkdown: md,
      parentId: 'p',
    })

    const lastCall = mockGetOne.mock.calls[0]?.[0]
    expect(lastCall?.artifactKey?.kind).toBe('transcript')
    expect(r.markdown).toContain('Transcript Markdown')
  })
})
