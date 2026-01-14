/**
 * @fileoverview Unit-Tests für Testimonial Writer
 * 
 * @description
 * Testet writeTestimonialArtifacts():
 * - Synchrones Schreiben von nur Transcript wenn Text vorhanden
 * - Transformation wird später im Finalisieren-Wizard erstellt
 * - Kein Schreiben wenn nur Audio vorhanden
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeTestimonialArtifacts } from '@/lib/testimonials/testimonial-writer'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer'
import { loadTemplateFromMongoDB } from '@/lib/templates/template-service-mongodb'

// Mock dependencies
vi.mock('@/lib/shadow-twin/artifact-writer', () => ({
  writeArtifact: vi.fn(),
}))

vi.mock('@/lib/templates/template-service-mongodb', () => ({
  loadTemplateFromMongoDB: vi.fn(),
}))

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/storage/shadow-twin', () => ({
  findShadowTwinFolder: vi.fn(),
  generateShadowTwinFolderName: vi.fn((name: string) => `.${name}`),
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

describe('writeTestimonialArtifacts', () => {
  let mockProvider: StorageProvider
  let mockSourceFile: StorageItem
  let mockTemplate: Awaited<ReturnType<typeof loadTemplateFromMongoDB>>

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider = createMockProvider()
    
    mockSourceFile = {
      id: 'source-123',
      type: 'file',
      metadata: { name: 'audio.webm' },
      parentId: 'testimonial-folder-123',
    }

    mockTemplate = {
      _id: 'event-testimonial-creation-de',
      name: 'event-testimonial-creation-de',
      libraryId: 'lib-123',
      user: 'test@example.com',
      metadata: {
        fields: [
          {
            key: 'speakerName',
            variable: 'speakerName',
            description: 'Name des Sprechers',
            rawValue: null,
          },
          {
            key: 'createdAt',
            variable: 'createdAt',
            description: 'Erstellungsdatum',
            rawValue: null,
          },
        ],
      },
      systemprompt: '',
      markdownBody: '{{speakerName|Name}} hat am {{createdAt|Datum}} gesagt: {{text|Text}}',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    } as Awaited<ReturnType<typeof loadTemplateFromMongoDB>>
  })

  it('sollte Transcript mit Metadaten synchron schreiben wenn Text vorhanden', async () => {
    const mockTranscriptResult = {
      file: { id: 'transcript-123', metadata: { name: 'audio.de.md' } },
      location: 'dotFolder' as const,
      shadowTwinFolderId: 'shadow-folder-123',
      wasUpdated: false,
    }

    vi.mocked(writeArtifact).mockResolvedValueOnce(mockTranscriptResult)

    const result = await writeTestimonialArtifacts({
      provider: mockProvider,
      eventFileId: 'event-123',
      testimonialFolderId: 'testimonial-folder-123',
      sourceFile: mockSourceFile,
      text: 'Das ist ein Test-Text',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
      libraryId: 'lib-123',
      userEmail: 'test@example.com',
      metadata: {
        speakerName: 'Max Mustermann',
        createdAt: '2026-01-14T12:00:00.000Z',
        testimonialId: 'test-123',
        eventFileId: 'event-123',
        consent: true,
      },
    })

    // Prüfe dass nur Transcript geschrieben wurde
    expect(writeArtifact).toHaveBeenCalledTimes(1)
    
    // Call: Transcript mit Frontmatter
    const callArgs = vi.mocked(writeArtifact).mock.calls[0]
    expect(callArgs[0]).toBe(mockProvider)
    expect(callArgs[1].key).toEqual({
      sourceId: 'source-123',
      kind: 'transcript',
      targetLanguage: 'de',
    })
    expect(callArgs[1].sourceName).toBe('audio.webm')
    expect(callArgs[1].parentId).toBe('testimonial-folder-123')
    expect(callArgs[1].createFolder).toBe(true)
    
    // Prüfe dass Content Frontmatter + Text enthält
    const content = callArgs[1].content as string
    expect(content).toContain('---')
    expect(content).toContain('speakerName: "Max Mustermann"')
    expect(content).toContain('createdAt: "2026-01-14T12:00:00.000Z"')
    expect(content).toContain('testimonialId: "test-123"')
    expect(content).toContain('eventFileId: "event-123"')
    expect(content).toContain('consent: true')
    expect(content).toContain('Das ist ein Test-Text')

    // Prüfe dass Template nicht geladen wurde (wird nicht mehr benötigt)
    expect(loadTemplateFromMongoDB).not.toHaveBeenCalled()

    expect(result.transcript).toEqual(mockTranscriptResult)
    expect(result.transformation).toBeUndefined()
  })

  it('sollte Transcript schreiben ohne Template zu laden', async () => {
    const mockTranscriptResult = {
      file: { id: 'transcript-123', metadata: { name: 'audio.de.md' } },
      location: 'dotFolder' as const,
      shadowTwinFolderId: 'shadow-folder-123',
      wasUpdated: false,
    }

    vi.mocked(writeArtifact).mockResolvedValueOnce(mockTranscriptResult)

    const result = await writeTestimonialArtifacts({
      provider: mockProvider,
      eventFileId: 'event-123',
      testimonialFolderId: 'testimonial-folder-123',
      sourceFile: mockSourceFile,
      text: 'Test-Text',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
      libraryId: 'lib-123',
      userEmail: 'test@example.com',
      metadata: {},
    })

    // Template wird nicht mehr geladen, da Transformation später erstellt wird
    expect(loadTemplateFromMongoDB).not.toHaveBeenCalled()
    expect(writeArtifact).toHaveBeenCalledTimes(1)
    expect(result.transcript).toEqual(mockTranscriptResult)
  })

  it('sollte nichts schreiben wenn kein Text vorhanden (Audio-only)', async () => {
    const result = await writeTestimonialArtifacts({
      provider: mockProvider,
      eventFileId: 'event-123',
      testimonialFolderId: 'testimonial-folder-123',
      sourceFile: mockSourceFile,
      text: null,
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
      libraryId: 'lib-123',
      userEmail: 'test@example.com',
      metadata: {},
    })

    expect(loadTemplateFromMongoDB).not.toHaveBeenCalled()
    expect(writeArtifact).not.toHaveBeenCalled()
    expect(result.transcript).toBeUndefined()
    expect(result.transformation).toBeUndefined()
  })

  it('sollte nichts schreiben wenn Text leer ist', async () => {
    const result = await writeTestimonialArtifacts({
      provider: mockProvider,
      eventFileId: 'event-123',
      testimonialFolderId: 'testimonial-folder-123',
      sourceFile: mockSourceFile,
      text: '   ',
      targetLanguage: 'de',
      templateName: 'event-testimonial-creation-de',
      libraryId: 'lib-123',
      userEmail: 'test@example.com',
      metadata: {},
    })

    expect(loadTemplateFromMongoDB).not.toHaveBeenCalled()
    expect(writeArtifact).not.toHaveBeenCalled()
    expect(result.transcript).toBeUndefined()
    expect(result.transformation).toBeUndefined()
  })
})
