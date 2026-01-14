/**
 * @fileoverview Unit-Tests für Testimonial Resolver
 * 
 * @description
 * Testet resolveTestimonialArtifact():
 * - Gibt 'ready' Status zurück wenn Transformation gefunden
 * - Gibt 'pending' Status zurück wenn Transformation fehlt
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveTestimonialArtifact } from '@/lib/testimonials/testimonial-resolver'
import type { StorageProvider } from '@/lib/storage/types'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'

// Mock dependencies
vi.mock('@/lib/shadow-twin/artifact-resolver', () => ({
  resolveArtifact: vi.fn(),
}))

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

/**
 * Erstellt einen Mock StorageProvider für Tests
 */
function createMockProvider(): StorageProvider {
  return {
    getItemById: vi.fn(),
    listItemsById: vi.fn(),
    getBinary: vi.fn(),
    uploadFile: vi.fn(),
    deleteItem: vi.fn(),
    createFolder: vi.fn(),
  } as unknown as StorageProvider
}

describe('resolveTestimonialArtifact', () => {
  let mockProvider: StorageProvider

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider = createMockProvider()
  })

  it('sollte "ready" Status zurückgeben wenn Transformation gefunden', async () => {
    const mockTransformation = {
      kind: 'transformation' as const,
      fileId: 'transformation-123',
      fileName: 'audio.event-testimonial-creation-de.de.md',
      location: 'dotFolder' as const,
      shadowTwinFolderId: 'shadow-folder-123',
    }

    vi.mocked(resolveArtifact).mockResolvedValue(mockTransformation)

    const result = await resolveTestimonialArtifact({
      provider: mockProvider,
      sourceItemId: 'source-123',
      sourceName: 'audio.webm',
      parentId: 'testimonial-folder-123',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
    })

    expect(result.status).toBe('ready')
    expect(result.transformation).toEqual(mockTransformation)

    expect(resolveArtifact).toHaveBeenCalledWith(mockProvider, {
      sourceItemId: 'source-123',
      sourceName: 'audio.webm',
      parentId: 'testimonial-folder-123',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
      preferredKind: 'transformation',
    })
  })

  it('sollte "pending" Status zurückgeben wenn Transformation nicht gefunden', async () => {
    vi.mocked(resolveArtifact).mockResolvedValue(null)

    const result = await resolveTestimonialArtifact({
      provider: mockProvider,
      sourceItemId: 'source-123',
      sourceName: 'audio.webm',
      parentId: 'testimonial-folder-123',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
    })

    expect(result.status).toBe('pending')
    expect(result.transformation).toBeNull()

    expect(resolveArtifact).toHaveBeenCalledWith(mockProvider, {
      sourceItemId: 'source-123',
      sourceName: 'audio.webm',
      parentId: 'testimonial-folder-123',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
      preferredKind: 'transformation',
    })
  })
})
