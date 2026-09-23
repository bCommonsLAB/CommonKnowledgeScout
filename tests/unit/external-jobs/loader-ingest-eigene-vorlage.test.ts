/**
 * @fileoverview Ingest-Loader veroeffentlicht die Vorlage des EIGENEN Jobs.
 *
 * Befund 23.09.2026: `shadowTwinState.transformed` zeigt auf die juengste
 * Transformation irgendeiner Vorlage (Stand vor der Template-Phase). Nach einem
 * abgebrochenen Lauf mit `pdfanalyse-commoning` veroeffentlichte der Ingest des
 * `commoning-methode-de`-Jobs das fremde Ergebnis. Prio 0 laedt jetzt exakt die
 * Vorlage des Jobs aus Mongo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMarkdown: vi.fn(),
  getLibrary: vi.fn(async () => ({ id: 'lib-1' })),
}))

vi.mock('@/lib/debug/logger', () => ({ FileLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: mocks.getLibrary }) },
}))
vi.mock('@/lib/shadow-twin/store/shadow-twin-service', () => ({
  ShadowTwinService: class { getMarkdown = mocks.getMarkdown },
}))
vi.mock('@/lib/shadow-twin/artifact-resolver', () => ({ resolveArtifact: vi.fn(async () => null) }))
vi.mock('@/lib/shadow-twin/shadow-twin-config', () => ({ getShadowTwinConfig: () => ({}) }))

import { loadShadowTwinMarkdown } from '@/lib/external-jobs/phase-shadow-twin-loader'
import type { RequestContext } from '@/types/external-jobs'
import type { StorageProvider } from '@/lib/storage/types'

const EIGENE = '---\ntemplate: commoning-methode-de\nmethoden_nummer: 8\n---\n\n# Kompass'
const FREMDE = '---\ntemplate: pdfanalyse-commoning\n---\n\n# Fremd'

function ctx(): RequestContext {
  return {
    jobId: 'job-2',
    job: {
      jobId: 'job-2', libraryId: 'lib-1', userEmail: 'u@example.org', job_type: 'text',
      correlation: { jobId: 'job-2', libraryId: 'lib-1', source: { name: 'methode-08.md', itemId: 'src-1', parentId: 'p', mediaType: 'markdown' }, options: { targetLanguage: 'de' } },
      parameters: { template: 'commoning-methode-de' },
      // Stand VOR der Template-Phase: die juengste Transformation war die fremde.
      shadowTwinState: { transformed: { id: 'mongo-fremd', metadata: { name: 'fremd.md' } } },
    },
    body: {}, callbackToken: undefined, internalBypass: true,
  } as unknown as RequestContext
}

const provider = { getBinary: vi.fn(async () => ({ blob: new Blob([FREMDE]) })) } as unknown as StorageProvider

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadShadowTwinMarkdown forIngestOrPassthrough', () => {
  it('Prio 0: laedt die Vorlage des Jobs exakt aus Mongo — nicht shadowTwinState.transformed', async () => {
    mocks.getMarkdown.mockImplementation(async (args: { templateName?: string }) =>
      args.templateName === 'commoning-methode-de'
        ? { id: 'mongo-eigen', name: 'eigen.md', markdown: EIGENE }
        : null,
    )
    const r = await loadShadowTwinMarkdown(ctx(), provider, 'forIngestOrPassthrough')
    expect(r?.fileId).toBe('mongo-eigen')
    expect(r?.meta).toMatchObject({ template: 'commoning-methode-de', methoden_nummer: 8 })
    expect(mocks.getMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'transformation', targetLanguage: 'de', templateName: 'commoning-methode-de' }),
    )
    expect(provider.getBinary).not.toHaveBeenCalled()
  })

  it('ohne Treffer fuer die Job-Vorlage greift weiter Prio 1 (shadowTwinState)', async () => {
    mocks.getMarkdown.mockResolvedValue(null)
    const r = await loadShadowTwinMarkdown(ctx(), provider, 'forIngestOrPassthrough')
    expect(mocks.getMarkdown).toHaveBeenCalled()
    // Prio 1 lief: das Ergebnis stammt aus dem Provider (loadMarkdownById).
    expect(provider.getBinary).toHaveBeenCalled()
    expect(r?.loadedArtifactKind).toBe('transformation')
  })
})
