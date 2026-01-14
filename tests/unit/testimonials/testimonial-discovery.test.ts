/**
 * @fileoverview Unit-Tests für Testimonial Discovery
 * 
 * @description
 * Testet discoverTestimonials():
 * - Transformation-Artefakte werden bevorzugt (mit resolveArtifact)
 * - Fallback auf Markdown-Dateien (alte Wizard-Testimonials)
 * - Fallback auf meta.json (alte anonyme Testimonials)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverTestimonials } from '@/lib/testimonials/testimonial-discovery'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

// Mock dependencies
vi.mock('@/lib/shadow-twin/artifact-resolver', () => ({
  resolveArtifact: vi.fn(),
}))

vi.mock('@/lib/markdown/frontmatter', () => ({
  parseFrontmatter: vi.fn(),
}))

/**
 * Erstellt einen Mock StorageProvider für Tests
 */
function createMockProvider(): StorageProvider {
  const items: Record<string, StorageItem[]> = {}
  const binaries: Record<string, string> = {}

  return {
    getItemById: vi.fn(async (id: string) => {
      // Suche in allen Items
      for (const itemList of Object.values(items)) {
        const found = itemList.find(item => item.id === id)
        if (found) return found
      }
      return null
    }),
    listItemsById: vi.fn(async (parentId: string) => {
      return items[parentId] || []
    }),
    getBinary: vi.fn(async (id: string) => {
      const content = binaries[id]
      if (content === undefined) throw new Error(`File not found: ${id}`)
      return { blob: new Blob([content], { type: 'text/markdown' }), mimeType: 'text/markdown' }
    }),
    uploadFile: vi.fn(),
    deleteItem: vi.fn(),
    createFolder: vi.fn(),
    _addItem: (item: StorageItem) => {
      const parentId = item.parentId || 'root'
      if (!items[parentId]) items[parentId] = []
      items[parentId].push(item)
    },
    _addBinary: (id: string, content: string) => {
      binaries[id] = content
    },
  } as unknown as StorageProvider & {
    _addItem: (item: StorageItem) => void
    _addBinary: (id: string, content: string) => void
  }
}

describe('discoverTestimonials', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let eventFile: StorageItem
  let eventFolder: StorageItem
  let testimonialsFolder: StorageItem

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider = createMockProvider()

    // Event-Struktur aufbauen
    eventFile = {
      id: 'event-123',
      type: 'file',
      metadata: { name: 'event.md' },
      parentId: 'event-folder-123',
    }

    eventFolder = {
      id: 'event-folder-123',
      type: 'folder',
      metadata: { name: 'event-folder' },
      parentId: 'root',
    }

    testimonialsFolder = {
      id: 'testimonials-folder-123',
      type: 'folder',
      metadata: { name: 'testimonials' },
      parentId: 'event-folder-123',
    }

    mockProvider._addItem(eventFile)
    mockProvider._addItem(eventFolder)
    mockProvider._addItem(testimonialsFolder)

    vi.mocked(mockProvider.getItemById).mockImplementation(async (id: string) => {
      if (id === 'event-123') return eventFile
      if (id === 'event-folder-123') return eventFolder
      if (id === 'testimonials-folder-123') return testimonialsFolder
      return null
    })
  })

  it('sollte Transformation-Artefakt bevorzugen wenn vorhanden', async () => {
    const testimonialFolder: StorageItem = {
      id: 'testimonial-folder-1',
      type: 'folder',
      metadata: { name: 'test-123' },
      parentId: 'testimonials-folder-123',
    }

    const sourceFile: StorageItem = {
      id: 'source-123',
      type: 'file',
      metadata: { name: 'audio.webm' },
      parentId: 'testimonial-folder-1',
    }

    const transformationFile: StorageItem = {
      id: 'transformation-123',
      type: 'file',
      metadata: { name: 'audio.event-testimonial-creation-de.de.md' },
      parentId: 'shadow-folder-123',
    }

    mockProvider._addItem(testimonialFolder)
    mockProvider._addItem(sourceFile)

    vi.mocked(mockProvider.listItemsById).mockImplementation(async (parentId: string) => {
      if (parentId === 'event-folder-123') return [testimonialsFolder]
      if (parentId === 'testimonials-folder-123') return [testimonialFolder]
      if (parentId === 'testimonial-folder-1') return [sourceFile]
      return []
    })

    // Mock resolveArtifact: Transformation gefunden
    vi.mocked(resolveArtifact).mockResolvedValue({
      kind: 'transformation',
      fileId: 'transformation-123',
      fileName: 'audio.event-testimonial-creation-de.de.md',
      location: 'dotFolder',
      shadowTwinFolderId: 'shadow-folder-123',
    })

    const transformationContent = `---
speakerName: "Max Mustermann"
createdAt: "2026-01-14T12:00:00.000Z"
---

Max Mustermann hat am 2026-01-14T12:00:00.000Z gesagt: Das ist ein Testimonial.`

    mockProvider._addBinary('transformation-123', transformationContent)
    vi.mocked(parseFrontmatter).mockReturnValue({
      meta: {
        speakerName: 'Max Mustermann',
        createdAt: '2026-01-14T12:00:00.000Z',
      },
      body: 'Das ist ein Testimonial.',
    })

    const results = await discoverTestimonials({
      provider: mockProvider,
      eventFileId: 'event-123',
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      testimonialId: 'test-123',
      speakerName: 'Max Mustermann',
      createdAt: '2026-01-14T12:00:00.000Z',
      text: 'Das ist ein Testimonial.',
      source: 'markdown',
      markdownFileId: 'transformation-123',
    })

    // Prüfe dass resolveArtifact aufgerufen wurde
    expect(resolveArtifact).toHaveBeenCalledWith(
      mockProvider,
      expect.objectContaining({
        sourceItemId: 'source-123',
        sourceName: 'audio.webm',
        parentId: 'testimonial-folder-1',
        targetLanguage: 'de',
        templateName: 'event-testimonial-creation-de',
        preferredKind: 'transformation',
      })
    )
  })

  it('sollte auf Markdown-Datei zurückfallen wenn kein Transformation-Artefakt gefunden', async () => {
    const testimonialFolder: StorageItem = {
      id: 'testimonial-folder-1',
      type: 'folder',
      metadata: { name: 'test-123' },
      parentId: 'testimonials-folder-123',
    }

    const markdownFile: StorageItem = {
      id: 'markdown-123',
      type: 'file',
      metadata: { name: 'testimonial.md' },
      parentId: 'testimonial-folder-1',
    }

    mockProvider._addItem(testimonialFolder)
    mockProvider._addItem(markdownFile)

    vi.mocked(mockProvider.listItemsById).mockImplementation(async (parentId: string) => {
      if (parentId === 'event-folder-123') return [testimonialsFolder]
      if (parentId === 'testimonials-folder-123') return [testimonialFolder]
      if (parentId === 'testimonial-folder-1') return [markdownFile]
      return []
    })

    // Mock resolveArtifact: Keine Transformation gefunden
    vi.mocked(resolveArtifact).mockResolvedValue(null)

    const markdownContent = `---
speakerName: "Petra Mustermann"
createdAt: "2026-01-15T10:00:00.000Z"
---

Das ist ein anderes Testimonial.`

    mockProvider._addBinary('markdown-123', markdownContent)
    vi.mocked(parseFrontmatter).mockReturnValue({
      meta: {
        speakerName: 'Petra Mustermann',
        createdAt: '2026-01-15T10:00:00.000Z',
      },
      body: 'Das ist ein anderes Testimonial.',
    })

    const results = await discoverTestimonials({
      provider: mockProvider,
      eventFileId: 'event-123',
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      testimonialId: 'test-123',
      speakerName: 'Petra Mustermann',
      createdAt: '2026-01-15T10:00:00.000Z',
      text: 'Das ist ein anderes Testimonial.',
      source: 'markdown',
      markdownFileId: 'markdown-123',
    })
  })

  it('sollte auf meta.json zurückfallen wenn weder Transformation noch Markdown gefunden', async () => {
    const testimonialFolder: StorageItem = {
      id: 'testimonial-folder-1',
      type: 'folder',
      metadata: { name: 'test-123' },
      parentId: 'testimonials-folder-123',
    }

    const audioFile: StorageItem = {
      id: 'audio-123',
      type: 'file',
      metadata: { name: 'audio.webm' },
      parentId: 'testimonial-folder-1',
    }

    const metaFile: StorageItem = {
      id: 'meta-123',
      type: 'file',
      metadata: { name: 'meta.json' },
      parentId: 'testimonial-folder-1',
    }

    mockProvider._addItem(testimonialFolder)
    mockProvider._addItem(audioFile)
    mockProvider._addItem(metaFile)

    vi.mocked(mockProvider.listItemsById).mockImplementation(async (parentId: string) => {
      if (parentId === 'event-folder-123') return [testimonialsFolder]
      if (parentId === 'testimonials-folder-123') return [testimonialFolder]
      if (parentId === 'testimonial-folder-1') return [audioFile, metaFile]
      return []
    })

    // Mock resolveArtifact: Keine Transformation gefunden
    vi.mocked(resolveArtifact).mockResolvedValue(null)

    const metaContent = JSON.stringify({
      testimonialId: 'test-123',
      createdAt: '2026-01-16T14:00:00.000Z',
      speakerName: 'Anna Mustermann',
      text: 'Das ist ein Testimonial aus meta.json',
    })

    mockProvider._addBinary('meta-123', metaContent)

    const results = await discoverTestimonials({
      provider: mockProvider,
      eventFileId: 'event-123',
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      testimonialId: 'test-123',
      speakerName: 'Anna Mustermann',
      createdAt: '2026-01-16T14:00:00.000Z',
      text: 'Das ist ein Testimonial aus meta.json',
      hasAudio: true,
      audioFileName: 'audio.webm',
      audioFileId: 'audio-123',
      source: 'meta.json',
      markdownFileId: null,
    })
  })

  it('sollte leeres Array zurückgeben wenn kein Event gefunden', async () => {
    vi.mocked(mockProvider.getItemById).mockResolvedValue(null)

    const results = await discoverTestimonials({
      provider: mockProvider,
      eventFileId: 'non-existent',
    })

    expect(results).toEqual([])
  })

  it('sollte leeres Array zurückgeben wenn kein testimonials-Ordner vorhanden', async () => {
    vi.mocked(mockProvider.listItemsById).mockImplementation(async (parentId: string) => {
      if (parentId === 'event-folder-123') return [] // Kein testimonials-Ordner
      return []
    })

    const results = await discoverTestimonials({
      provider: mockProvider,
      eventFileId: 'event-123',
    })

    expect(results).toEqual([])
  })
})
