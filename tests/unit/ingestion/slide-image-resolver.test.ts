/**
 * Welle J2: Folienbilder gegen die Fragmente des eigenen Twins und der
 * Quellen-Twins (`compositeSources`) aufloesen —
 * `src/lib/ingestion/slide-image-resolver.ts`.
 *
 * Mock: `getShadowTwinsBySourceIds` liefert Twin-Dokumente aus einer Map;
 * die Fragmente tragen `variant` und `pageNumber` wie der Direct-Upload
 * der PDF-Extraktion (`preview_NNN.jpeg` = thumbnail, `page_NNN.jpeg` =
 * page-render; `jpg` wird dort zu `jpeg` normalisiert).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const twins = new Map<string, Record<string, unknown>>()

vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinsBySourceIds: vi.fn(async (args: { sourceIds: string[] }) => {
    const out = new Map<string, Record<string, unknown>>()
    for (const id of args.sourceIds) {
      const doc = twins.get(id)
      if (doc) out.set(id, doc)
    }
    return out
  }),
}))

import { resolveSlideImagesFromTwinFragments } from '@/lib/ingestion/slide-image-resolver'

function seiten(prefix: string, variant: 'thumbnail' | 'page-render', n: number, url: string) {
  return Array.from({ length: n }, (_, i) => ({
    name: `${prefix}_${String(i + 1).padStart(3, '0')}.jpeg`,
    url: `${url}/${prefix}_${String(i + 1).padStart(3, '0')}.jpeg`,
    variant,
    pageNumber: i + 1,
  }))
}

beforeEach(() => {
  twins.clear()
})

describe('resolveSlideImagesFromTwinFragments', () => {
  it('loest nackte Namen ueber die Seitenbilder der Folien-PDF aus compositeSources auf (jpg → jpeg)', async () => {
    twins.set('sammel', { sourceId: 'sammel', sourceName: 'Vortrag.md', compositeSources: ['audio', 'folien'], binaryFragments: [] })
    twins.set('audio', { sourceId: 'audio', sourceName: 'Vortrag.mp3', binaryFragments: [] })
    twins.set('folien', {
      sourceId: 'folien', sourceName: 'Folien.pdf',
      binaryFragments: [...seiten('preview', 'thumbnail', 3, 'https://blob/folien'), ...seiten('page', 'page-render', 3, 'https://blob/folien')],
    })

    const r = await resolveSlideImagesFromTwinFragments('lib', 'sammel', [
      { page_num: 1, image_url: 'preview_001.jpg' },
      { page_num: 2, image_url: 'page_002.jpg' },
      { page_num: 3, image_url: 'preview_003.jpeg' },
    ])

    expect(r.resolved).toBe(3)
    expect(r.unresolved).toEqual([])
    expect(r.slides.map((s) => s.image_url)).toEqual([
      'https://blob/folien/preview_001.jpeg',
      'https://blob/folien/page_002.jpeg',
      'https://blob/folien/preview_003.jpeg',
    ])
    expect(r.sources.map((s) => s.sourceId)).toEqual(['sammel', 'folien', 'audio'])
  })

  it('bevorzugt die PDF mit den meisten Seitenbildern vor einem Flyer', async () => {
    twins.set('sammel', { sourceId: 'sammel', sourceName: 'V.md', compositeSources: ['flyer', 'folien'] })
    twins.set('flyer', { sourceId: 'flyer', sourceName: 'Einladung.pdf', binaryFragments: seiten('preview', 'thumbnail', 1, 'https://blob/flyer') })
    twins.set('folien', { sourceId: 'folien', sourceName: 'Folien.pdf', binaryFragments: seiten('preview', 'thumbnail', 20, 'https://blob/folien') })

    const r = await resolveSlideImagesFromTwinFragments('lib', 'sammel', [{ page_num: 1, image_url: 'preview_001.jpg' }])
    expect(r.slides[0].image_url).toBe('https://blob/folien/preview_001.jpeg')
    expect(r.sources.map((s) => s.sourceId)).toEqual(['sammel', 'folien', 'flyer'])
  })

  it('nimmt den eigenen Twin zuerst (exakter Name) und laesst absolute URLs in Ruhe', async () => {
    twins.set('sammel', {
      sourceId: 'sammel', sourceName: 'V.md', compositeSources: ['folien'],
      binaryFragments: [{ name: 'preview_001.jpg', url: 'https://blob/eigen/preview_001.jpg', variant: 'preview', pageNumber: 1 }],
    })
    twins.set('folien', { sourceId: 'folien', sourceName: 'Folien.pdf', binaryFragments: seiten('preview', 'thumbnail', 2, 'https://blob/folien') })

    const r = await resolveSlideImagesFromTwinFragments('lib', 'sammel', [
      { page_num: 1, image_url: 'preview_001.jpg' },
      { page_num: 2, image_url: 'https://cdn/bild.jpg' },
    ])
    expect(r.slides[0].image_url).toBe('https://blob/eigen/preview_001.jpg')
    expect(r.slides[1].image_url).toBe('https://cdn/bild.jpg')
    expect(r.resolved).toBe(1)
  })

  it('loest Folien ohne image_url ueber page_num auf, thumbnail vor page-render', async () => {
    twins.set('sammel', { sourceId: 'sammel', sourceName: 'V.md', compositeSources: ['folien'] })
    twins.set('folien', {
      sourceId: 'folien', sourceName: 'Folien.pdf',
      binaryFragments: [...seiten('page', 'page-render', 2, 'https://blob/f'), ...seiten('preview', 'thumbnail', 1, 'https://blob/f')],
    })

    const r = await resolveSlideImagesFromTwinFragments('lib', 'sammel', [{ page_num: 1 }, { page_num: 2, image_url: '' }, { page_num: 9 }])
    expect(r.slides[0].image_url).toBe('https://blob/f/preview_001.jpeg')
    expect(r.slides[1].image_url).toBe('https://blob/f/page_002.jpeg')
    expect(r.slides[2].image_url).toBeUndefined()
    expect(r.unresolved).toEqual(['Seite 9'])
  })

  it('laesst Namen ohne Treffer unveraendert und nennt sie in unresolved', async () => {
    twins.set('sammel', { sourceId: 'sammel', sourceName: 'V.md' })
    const r = await resolveSlideImagesFromTwinFragments('lib', 'sammel', [
      { page_num: 1, image_url: 'preview_001.jpg' },
      { page_num: 2, image_url: 'pfad/im/storage/bild.jpg' },
    ])
    expect(r.resolved).toBe(0)
    expect(r.unresolved).toEqual(['preview_001.jpg'])
    expect(r.slides[0].image_url).toBe('preview_001.jpg')
    expect(r.slides[1].image_url).toBe('pfad/im/storage/bild.jpg')
  })

  it('versteht Twin-relative Verweise (_Folien.pdf/preview_002.jpg)', async () => {
    twins.set('sammel', { sourceId: 'sammel', sourceName: 'V.md', compositeSources: ['folien'] })
    twins.set('folien', { sourceId: 'folien', sourceName: 'Folien.pdf', binaryFragments: seiten('preview', 'thumbnail', 2, 'https://blob/f') })
    const r = await resolveSlideImagesFromTwinFragments('lib', 'sammel', [{ page_num: 2, image_url: '_Folien.pdf/preview_002.jpg' }])
    expect(r.slides[0].image_url).toBe('https://blob/f/preview_002.jpeg')
  })
})
