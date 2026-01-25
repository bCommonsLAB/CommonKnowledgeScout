/**
 * @fileoverview Unit Tests für ShadowTwinService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { MongoShadowTwinStore } from '@/lib/shadow-twin/store/mongo-shadow-twin-store'
import { ProviderShadowTwinStore } from '@/lib/shadow-twin/store/provider-shadow-twin-store'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import type { Library } from '@/types/library'

vi.mock('@/lib/shadow-twin/store/mongo-shadow-twin-store')
vi.mock('@/lib/shadow-twin/store/provider-shadow-twin-store')
vi.mock('@/lib/shadow-twin/shadow-twin-config')

describe('ShadowTwinService', () => {
  const mockLibrary: Library = {
    id: 'test-library-id',
    label: 'Test Library',
    type: 'local',
    path: '/test',
    isEnabled: true,
    config: {
      shadowTwin: {
        primaryStore: 'mongo',
        allowFilesystemFallback: true,
      },
    },
  } as Library

  const mockOptions = {
    library: mockLibrary,
    userEmail: 'test@example.com',
    sourceId: 'test-source-id',
    sourceName: 'test.pdf',
    parentId: 'test-parent-id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getShadowTwinConfig).mockReturnValue({
      primaryStore: 'mongo',
      persistToFilesystem: false,
      cleanupFilesystemOnMigrate: false,
      allowFilesystemFallback: true,
    })
  })

  it('sollte MongoShadowTwinStore verwenden wenn primaryStore=mongo', () => {
    vi.mocked(getShadowTwinConfig).mockReturnValue({
      primaryStore: 'mongo',
      persistToFilesystem: false,
      cleanupFilesystemOnMigrate: false,
      allowFilesystemFallback: false,
    })

    const service = new ShadowTwinService(mockOptions)

    expect(MongoShadowTwinStore).toHaveBeenCalledWith(
      mockLibrary.id,
      mockOptions.userEmail,
      mockOptions.sourceName,
      mockOptions.parentId
    )
  })

  it('sollte exists true zurückgeben wenn Artefakt im Primary Store existiert', async () => {
    const mockStore = {
      existsArtifact: vi.fn().mockResolvedValue(true),
      getArtifactMarkdown: vi.fn(),
      upsertArtifact: vi.fn(),
      getBinaryFragments: vi.fn(),
    }

    vi.mocked(MongoShadowTwinStore).mockImplementation(() => mockStore as unknown as MongoShadowTwinStore)

    const service = new ShadowTwinService(mockOptions)
    const result = await service.exists({
      kind: 'transcript',
      targetLanguage: 'de',
    })

    expect(result).toBe(true)
    expect(mockStore.existsArtifact).toHaveBeenCalled()
  })

  it('sollte exists false zurückgeben wenn Artefakt nicht existiert', async () => {
    const mockStore = {
      existsArtifact: vi.fn().mockResolvedValue(false),
      getArtifactMarkdown: vi.fn(),
      upsertArtifact: vi.fn(),
      getBinaryFragments: vi.fn(),
    }

    vi.mocked(MongoShadowTwinStore).mockImplementation(() => mockStore as unknown as MongoShadowTwinStore)
    vi.mocked(ProviderShadowTwinStore).mockImplementation(() => ({
      existsArtifact: vi.fn().mockResolvedValue(false),
      getArtifactMarkdown: vi.fn(),
      upsertArtifact: vi.fn(),
      getBinaryFragments: vi.fn(),
    }) as unknown as ProviderShadowTwinStore)

    const service = new ShadowTwinService({
      ...mockOptions,
      provider: {} as any,
    })
    const result = await service.exists({
      kind: 'transcript',
      targetLanguage: 'de',
    })

    expect(result).toBe(false)
  })

  it('sollte Transformation als Superset von Transcript erkennen', async () => {
    const mockPrimaryStore = {
      existsArtifact: vi.fn()
        .mockResolvedValueOnce(false) // Transcript nicht gefunden
        .mockResolvedValueOnce(true), // Transformation gefunden
      getArtifactMarkdown: vi.fn(),
      upsertArtifact: vi.fn(),
      getBinaryFragments: vi.fn(),
    }

    vi.mocked(MongoShadowTwinStore).mockImplementation(() => mockPrimaryStore as unknown as MongoShadowTwinStore)

    const service = new ShadowTwinService(mockOptions)
    const result = await service.exists({
      kind: 'transcript',
      targetLanguage: 'de',
      includeSupersets: true,
      templateName: 'pdfanalyse',
    })

    expect(result).toBe(true)
    // Prüfe, dass auch Transformation geprüft wurde
    expect(mockPrimaryStore.existsArtifact).toHaveBeenCalledTimes(2)
  })

  it('sollte leeres Markdown beim upsert ablehnen (Domain-Regel)', async () => {
    const mockStore = {
      existsArtifact: vi.fn(),
      getArtifactMarkdown: vi.fn(),
      upsertArtifact: vi.fn(),
      getBinaryFragments: vi.fn(),
    }

    vi.mocked(MongoShadowTwinStore).mockImplementation(() => mockStore as unknown as MongoShadowTwinStore)

    const service = new ShadowTwinService(mockOptions)

    await expect(
      service.upsertMarkdown({
        kind: 'transcript',
        targetLanguage: 'de',
        markdown: '   \n',
      })
    ).rejects.toThrow(/Leeres Markdown darf nicht gespeichert werden/i)

    expect(mockStore.upsertArtifact).not.toHaveBeenCalled()
  })
})
