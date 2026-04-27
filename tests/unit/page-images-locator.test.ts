/**
 * @fileoverview Unit-Tests fuer page-images-locator.ts
 *
 * Wir mocken das Repository und den Storage-Provider, damit wir den Locator
 * deterministisch durch verschiedene Datenlagen testen koennen, ohne MongoDB
 * oder Storage-Backend zu involvieren.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { locatePageImagesForPdf, NoPageImagesError } from '@/lib/pdf/page-images-locator'
import { getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

vi.mock('@/lib/repositories/shadow-twin-repo')
vi.mock('@/lib/storage/shadow-twin')

const sourcePdf: StorageItem = {
  id: 'src-1',
  parentId: 'parent-1',
  type: 'file',
  metadata: {
    name: 'GADERFORM PREISLISTE.pdf',
    size: 1234,
    modifiedAt: new Date(0),
    mimeType: 'application/pdf',
  },
}

function buildBinaryFragment(opts: {
  name: string
  url: string
  variant?: 'page-render' | 'thumbnail' | 'original'
  pageNumber?: number
}) {
  return {
    name: opts.name,
    url: opts.url,
    kind: 'image',
    mimeType: 'image/png',
    variant: opts.variant,
    pageNumber: opts.pageNumber,
  }
}

function buildProvider(
  overrides: Partial<StorageProvider>
): StorageProvider {
  // Minimaler Stub mit nur den Methoden, die der Locator nutzt.
  return {
    name: 'test-provider',
    listItemsById: vi.fn().mockResolvedValue([]),
    getBinary: vi.fn(),
    ...overrides,
  } as unknown as StorageProvider
}

describe('locatePageImagesForPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // global.fetch fuer Mongo-Pfad mocken (wir geben fixe Bytes zurueck)
    global.fetch = vi.fn(async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
      return new Response(blob, { status: 200 })
    }) as unknown as typeof fetch
  })

  describe('Mongo-Pfad', () => {
    it('liefert sortierte Page-Bilder bei expliziter variant=page-render-Markierung', async () => {
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([
        buildBinaryFragment({ name: 'page_002.png', url: 'https://x/2.png', variant: 'page-render', pageNumber: 2 }),
        buildBinaryFragment({ name: 'page_001.png', url: 'https://x/1.png', variant: 'page-render', pageNumber: 1 }),
        buildBinaryFragment({ name: 'img-0.jpeg', url: 'https://x/i.jpg', variant: 'original' }),
      ])

      const result = await locatePageImagesForPdf({
        libraryId: 'lib-1',
        sourceItem: sourcePdf,
        provider: buildProvider({}),
      })

      expect(result.source).toBe('mongo')
      expect(result.pages.map((p) => p.pageNumber)).toEqual([1, 2])
      expect(result.pages[0].fileName).toBe('page_001.png')
      expect(result.pages[1].fileName).toBe('page_002.png')
    })

    it('erkennt Page-Bilder heuristisch ueber den Dateinamen (Backwards-Compat ohne variant-Feld)', async () => {
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([
        buildBinaryFragment({ name: 'page_003.png', url: 'https://x/3.png' }),
        buildBinaryFragment({ name: 'img-0.jpeg', url: 'https://x/i.jpg' }),
      ])

      const result = await locatePageImagesForPdf({
        libraryId: 'lib-1',
        sourceItem: sourcePdf,
        provider: buildProvider({}),
      })

      expect(result.source).toBe('mongo')
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].pageNumber).toBe(3)
    })

    it('ignoriert Thumbnails (variant=thumbnail) im Mongo-Pfad', async () => {
      // Hard-Rename: Mistral liefert seit dem neuen Secretary-API beide Aufloesungen
      // parallel. Der Locator zielt aber bewusst auf die HighRes-Renderings, weil
      // Thumbnails fuer die Weiterverarbeitung (Split-Pages) zu klein sind.
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([
        // HighRes (variant='page-render') -> wird genutzt
        buildBinaryFragment({ name: 'page_001.jpeg', url: 'https://x/h1.jpg', variant: 'page-render', pageNumber: 1 }),
        buildBinaryFragment({ name: 'page_002.jpeg', url: 'https://x/h2.jpg', variant: 'page-render', pageNumber: 2 }),
        // Thumbnails (variant='thumbnail') -> muessen ignoriert werden
        buildBinaryFragment({ name: 'preview_001.jpg', url: 'https://x/p1.jpg', variant: 'thumbnail', pageNumber: 1 }),
        buildBinaryFragment({ name: 'preview_002.jpg', url: 'https://x/p2.jpg', variant: 'thumbnail', pageNumber: 2 }),
      ])

      const result = await locatePageImagesForPdf({
        libraryId: 'lib-1',
        sourceItem: sourcePdf,
        provider: buildProvider({}),
      })

      expect(result.source).toBe('mongo')
      expect(result.pages).toHaveLength(2)
      // Es duerfen ausschliesslich die HighRes-URLs sichtbar sein.
      expect(result.pages.map((p) => p.fileName)).toEqual(['page_001.jpeg', 'page_002.jpeg'])
    })

    it('ignoriert preview_NNN.jpg auch ohne variant-Feld (Pattern matched nicht auf preview_)', async () => {
      // Backwards-Compat-Pfad: Wenn das variant-Feld fehlt, faellt der Locator auf den
      // Namens-Pattern zurueck. Das Pattern lautet ^page[_-]\d+\.(png|jpe?g)$ und matcht
      // bewusst nicht auf preview_NNN.jpg, sodass die niedrig aufgeloesten Vorschauen
      // auch bei Alt-Dokumenten zuverlaessig ausgefiltert werden.
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([
        buildBinaryFragment({ name: 'page_001.jpeg', url: 'https://x/h1.jpg' }),
        buildBinaryFragment({ name: 'preview_001.jpg', url: 'https://x/p1.jpg' }),
      ])

      const result = await locatePageImagesForPdf({
        libraryId: 'lib-1',
        sourceItem: sourcePdf,
        provider: buildProvider({}),
      })

      expect(result.source).toBe('mongo')
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].fileName).toBe('page_001.jpeg')
    })

    it('ignoriert Fragmente ohne URL und nicht-Image-Eintraege', async () => {
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([
        { name: 'page_001.png', kind: 'image' }, // keine URL -> skip
        { ...buildBinaryFragment({ name: 'page_002.png', url: 'https://x/2.png', variant: 'page-render', pageNumber: 2 }), kind: 'audio' }, // skip wg. kind
      ] as unknown as Awaited<ReturnType<typeof getShadowTwinBinaryFragments>>)

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null)

      await expect(
        locatePageImagesForPdf({
          libraryId: 'lib-1',
          sourceItem: sourcePdf,
          provider: buildProvider({}),
        })
      ).rejects.toBeInstanceOf(NoPageImagesError)
    })
  })

  describe('Filesystem-Fallback', () => {
    it('liest page_NNN.<ext>-Dateien aus dem Shadow-Twin-Folder, wenn Mongo leer ist', async () => {
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([])
      vi.mocked(findShadowTwinFolder).mockResolvedValue({
        id: 'folder-1',
        parentId: 'parent-1',
        type: 'folder',
        metadata: { name: 'GADERFORM PREISLISTE', size: 0, modifiedAt: new Date(0) },
      } as StorageItem)

      const provider = buildProvider({
        listItemsById: vi.fn().mockResolvedValue([
          {
            id: 'f-2',
            parentId: 'folder-1',
            type: 'file',
            metadata: { name: 'page_002.png', size: 100, modifiedAt: new Date(0), mimeType: 'image/png' },
          },
          {
            id: 'f-1',
            parentId: 'folder-1',
            type: 'file',
            metadata: { name: 'page_001.png', size: 100, modifiedAt: new Date(0), mimeType: 'image/png' },
          },
          {
            id: 'f-irrelevant',
            parentId: 'folder-1',
            type: 'file',
            metadata: { name: 'img-0.jpeg', size: 50, modifiedAt: new Date(0), mimeType: 'image/jpeg' },
          },
        ] as StorageItem[]),
        getBinary: vi.fn().mockImplementation(async (id: string) => ({
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
          fileName: id,
        })),
      })

      const result = await locatePageImagesForPdf({
        libraryId: 'lib-1',
        sourceItem: sourcePdf,
        provider,
      })

      expect(result.source).toBe('filesystem')
      expect(result.pages.map((p) => p.pageNumber)).toEqual([1, 2])
    })
  })

  describe('Fehlerfall', () => {
    it('wirft NoPageImagesError, wenn weder Mongo noch Filesystem etwas liefern', async () => {
      vi.mocked(getShadowTwinBinaryFragments).mockResolvedValue([])
      vi.mocked(findShadowTwinFolder).mockResolvedValue(null)

      await expect(
        locatePageImagesForPdf({
          libraryId: 'lib-1',
          sourceItem: sourcePdf,
          provider: buildProvider({}),
        })
      ).rejects.toMatchObject({
        name: 'NoPageImagesError',
        code: 'no_page_images',
      })
    })
  })
})
