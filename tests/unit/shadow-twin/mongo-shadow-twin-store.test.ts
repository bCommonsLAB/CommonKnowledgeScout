/**
 * @fileoverview Unit Tests für MongoShadowTwinStore
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MongoShadowTwinStore } from '@/lib/shadow-twin/store/mongo-shadow-twin-store'
import * as shadowTwinRepo from '@/lib/repositories/shadow-twin-repo'
import * as mongoShadowTwinId from '@/lib/shadow-twin/mongo-shadow-twin-id'
import * as artifactNaming from '@/lib/shadow-twin/artifact-naming'

vi.mock('@/lib/repositories/shadow-twin-repo')
vi.mock('@/lib/shadow-twin/mongo-shadow-twin-id')
vi.mock('@/lib/shadow-twin/artifact-naming')

describe('MongoShadowTwinStore', () => {
  const mockLibraryId = 'test-library-id'
  const mockUserEmail = 'test@example.com'
  const mockSourceName = 'test.pdf'
  const mockParentId = 'test-parent-id'
  const mockSourceId = 'test-source-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sollte existsArtifact true zurückgeben wenn Artefakt existiert', async () => {
    const store = new MongoShadowTwinStore(mockLibraryId, mockUserEmail, mockSourceName, mockParentId)
    const mockKey = {
      sourceId: mockSourceId,
      kind: 'transcript' as const,
      targetLanguage: 'de',
    }

    vi.mocked(shadowTwinRepo.getShadowTwinArtifact).mockResolvedValue({
      markdown: 'test markdown',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    })

    const result = await store.existsArtifact(mockKey)

    expect(result).toBe(true)
    expect(shadowTwinRepo.getShadowTwinArtifact).toHaveBeenCalledWith({
      libraryId: mockLibraryId,
      sourceId: mockSourceId,
      artifactKey: mockKey,
    })
  })

  it('sollte existsArtifact false zurückgeben wenn Artefakt nicht existiert', async () => {
    const store = new MongoShadowTwinStore(mockLibraryId, mockUserEmail, mockSourceName, mockParentId)
    const mockKey = {
      sourceId: mockSourceId,
      kind: 'transcript' as const,
      targetLanguage: 'de',
    }

    vi.mocked(shadowTwinRepo.getShadowTwinArtifact).mockResolvedValue(null)

    const result = await store.existsArtifact(mockKey)

    expect(result).toBe(false)
  })

  it('sollte getArtifactMarkdown Artefakt zurückgeben wenn vorhanden', async () => {
    const store = new MongoShadowTwinStore(mockLibraryId, mockUserEmail, mockSourceName, mockParentId)
    const mockKey = {
      sourceId: mockSourceId,
      kind: 'transcript' as const,
      targetLanguage: 'de',
    }
    const mockRecord = {
      markdown: 'test markdown',
      frontmatter: { title: 'Test' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }

    vi.mocked(shadowTwinRepo.getShadowTwinArtifact).mockResolvedValue(mockRecord)
    vi.mocked(mongoShadowTwinId.buildMongoShadowTwinId).mockReturnValue('mongo-id-123')
    vi.mocked(artifactNaming.buildArtifactName).mockReturnValue('test.de.md')

    const result = await store.getArtifactMarkdown(mockKey)

    expect(result).toEqual({
      id: 'mongo-id-123',
      name: 'test.de.md',
      markdown: 'test markdown',
      frontmatter: { title: 'Test' },
    })
  })

  it('sollte getArtifactMarkdown null zurückgeben wenn Artefakt nicht existiert', async () => {
    const store = new MongoShadowTwinStore(mockLibraryId, mockUserEmail, mockSourceName, mockParentId)
    const mockKey = {
      sourceId: mockSourceId,
      kind: 'transcript' as const,
      targetLanguage: 'de',
    }

    vi.mocked(shadowTwinRepo.getShadowTwinArtifact).mockResolvedValue(null)

    const result = await store.getArtifactMarkdown(mockKey)

    expect(result).toBeNull()
  })
})
