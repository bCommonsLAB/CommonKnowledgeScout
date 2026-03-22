import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  looksLikeHexHashImageFileName,
  buildCompositeMediaLayout,
  buildAggregatedMediaForSources,
  type MediaFileInfo,
} from '@/lib/media/aggregated-media-service'
import { getShadowTwinArtifact, getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'

vi.mock('@/lib/repositories/shadow-twin-repo', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/repositories/shadow-twin-repo')>()
  return {
    ...mod,
    getShadowTwinArtifact: vi.fn(),
    getShadowTwinBinaryFragments: vi.fn(),
  }
})

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn(),
}))

const emptyArtifact = {
  markdown: '',
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
}

describe('looksLikeHexHashImageFileName', () => {
  it('erkennt lange Hex-Blob-Namen mit Bildendung', () => {
    expect(looksLikeHexHashImageFileName('326c3b8ce2b1ad76abcdef1234567890.jpeg')).toBe(true)
  })

  it('lehnt übliche Fragment-Namen ab', () => {
    expect(looksLikeHexHashImageFileName('img-0.jpeg')).toBe(false)
    expect(looksLikeHexHashImageFileName('cover-photo.png')).toBe(false)
  })
})

describe('buildCompositeMediaLayout', () => {
  beforeEach(() => {
    vi.mocked(getShadowTwinArtifact).mockResolvedValue(emptyArtifact)
  })

  it('trennt gleiche Fragment-Dateinamen pro PDF (zwei Sektionen)', async () => {
    const sourceItems = [
      { id: 'pdf-a', name: 'a.pdf', parentId: 'folder1' },
      { id: 'pdf-b', name: 'b.pdf', parentId: 'folder1' },
    ]
    const mediaFiles: MediaFileInfo[] = [
      { name: 'img-0.jpeg', size: 10, mimeType: 'image/jpeg', sourceFile: 'a.pdf' },
      { name: 'img-0.jpeg', size: 11, mimeType: 'image/jpeg', sourceFile: 'b.pdf' },
    ]

    const { pdfSections } = await buildCompositeMediaLayout('lib-1', 'de', sourceItems, mediaFiles)

    expect(pdfSections).toHaveLength(2)
    expect(pdfSections[0].pdfFileName).toBe('a.pdf')
    expect(pdfSections[0].fragments).toHaveLength(1)
    expect(pdfSections[0].fragments[0].name).toBe('img-0.jpeg')
    expect(pdfSections[1].pdfFileName).toBe('b.pdf')
    expect(pdfSections[1].fragments[0].name).toBe('img-0.jpeg')
    expect(pdfSections[0].fragments[0]).not.toBe(pdfSections[1].fragments[0])
  })

  it('mappt Hash-Blob-Namen aus Mongo auf kanonischen Namen aus Transkript-Markdown', async () => {
    const sourceItems = [{ id: 'pdf-1', name: 'bericht.pdf', parentId: 'folder1' }]
    const blobUrl = 'https://blob.example/container/abc123def4567890abcdef1234567890.jpeg'
    const mediaFiles: MediaFileInfo[] = [
      {
        name: 'abc123def4567890abcdef1234567890.jpeg',
        size: 100,
        mimeType: 'image/jpeg',
        sourceFile: 'bericht.pdf',
        url: blobUrl,
      },
    ]

    vi.mocked(getShadowTwinArtifact).mockResolvedValue({
      markdown: `Seite 1\n\n![img-0.jpeg](${blobUrl})`,
      createdAt: emptyArtifact.createdAt,
      updatedAt: emptyArtifact.updatedAt,
    })

    const { pdfSections } = await buildCompositeMediaLayout('lib-1', 'de', sourceItems, mediaFiles)

    expect(pdfSections).toHaveLength(1)
    expect(pdfSections[0].fragments[0].name).toBe('img-0.jpeg')
    expect(pdfSections[0].fragments[0].originalName).toBe('abc123def4567890abcdef1234567890.jpeg')
  })
})

describe('buildAggregatedMediaForSources (Alt-Mongo + Ordner)', () => {
  beforeEach(() => {
    vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue(null)
    vi.mocked(getShadowTwinArtifact).mockResolvedValue(emptyArtifact)
    vi.mocked(getServerProvider).mockResolvedValue({
      listItemsById: vi.fn().mockResolvedValue([]),
    } as unknown as Awaited<ReturnType<typeof getServerProvider>>)
  })

  it('liefert nach Transkript-Mapping kanonische Fragment-Namen im Gesamtergebnis', async () => {
    const blobUrl = 'https://x.test/h326c3b8ce2b1ad76.jpeg'
    vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([
      {
        name: 'h326c3b8ce2b1ad76.jpeg',
        url: blobUrl,
        mimeType: 'image/jpeg',
        size: 50,
        kind: 'image',
      },
    ])

    vi.mocked(getShadowTwinArtifact).mockResolvedValue({
      markdown: `![img-0.jpeg](${blobUrl})`,
      createdAt: emptyArtifact.createdAt,
      updatedAt: emptyArtifact.updatedAt,
    })

    const { pdfSections } = await buildAggregatedMediaForSources({
      libraryId: 'lib-x',
      userEmail: 'u@test.de',
      targetLanguage: 'de',
      sourceItems: [{ id: 'src1', name: 'doc.pdf', parentId: 'p1' }],
    })

    expect(pdfSections[0]?.fragments[0]?.name).toBe('img-0.jpeg')
  })
})
