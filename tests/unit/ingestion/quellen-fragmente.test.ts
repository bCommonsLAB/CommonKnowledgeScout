/**
 * Welle J Nachzug: Die Nachregistrierung aus dem Twin-Ordner nennt Vorschauen
 * `preview`, der Direct-Upload `thumbnail` — beide sind dieselbe Vorschau.
 */
import { describe, expect, it } from 'vitest'
import { hatVariante, nachSeite, type Fragment } from '@/lib/ingestion/quellen-fragmente'

const preview: Fragment = { name: 'preview_002.jpg', url: 'https://b/preview_002.jpg', variant: 'preview', pageNumber: 2 }
const page: Fragment = { name: 'page_002.jpeg', url: 'https://b/page_002.jpeg', variant: 'page-render', pageNumber: 2 }
const ocr: Fragment = { name: 'img-0.jpeg', url: 'https://b/img-0.jpeg' }

describe('hatVariante', () => {
  it('laesst preview als Vorschau gelten, page-render bleibt eigen', () => {
    expect(hatVariante(preview, 'thumbnail')).toBe(true)
    expect(hatVariante({ ...preview, variant: 'thumbnail' }, 'thumbnail')).toBe(true)
    expect(hatVariante(preview, 'page-render')).toBe(false)
    expect(hatVariante(page, 'page-render')).toBe(true)
    expect(hatVariante(ocr, 'thumbnail')).toBe(false)
  })
})

describe('nachSeite mit nachregistrierten Fragmenten', () => {
  it('findet die Vorschau unter preview und die hochaufloesende Seite unter page-render', () => {
    expect(nachSeite([ocr, preview, page], 2, 'thumbnail')).toBe('https://b/preview_002.jpg')
    expect(nachSeite([ocr, preview, page], 2, 'page-render')).toBe('https://b/page_002.jpeg')
    expect(nachSeite([ocr, preview], 2, 'page-render')).toBe('https://b/preview_002.jpg')
    expect(nachSeite([ocr], 2, 'thumbnail')).toBeUndefined()
  })
})

describe('fragmenteAusTwin / seitenAusName (Nachzug 3)', () => {
  it('leitet Seitennummer und Variante aus dem Namen ab, wenn das Fragment sie nicht traegt', async () => {
    const { fragmenteAusTwin, seitenAusName } = await import('@/lib/ingestion/quellen-fragmente')
    expect(seitenAusName('preview_007.jpg')).toEqual({ pageNumber: 7, variant: 'preview' })
    expect(seitenAusName('page_012.jpeg')).toEqual({ pageNumber: 12, variant: 'page-render' })
    expect(seitenAusName('img-0.jpeg')).toBeNull()
    const doc = { binaryFragments: [
      { name: 'page_002.jpeg', url: 'https://b/p2', variant: 'page-render' },
      { name: 'preview_002.jpg', url: 'https://b/v2' },
      { name: 'img-0.jpeg', url: 'https://b/i0' },
      { name: 'page_003.jpeg', url: 'https://b/p3', variant: 'page-render', pageNumber: 3 },
    ] } as unknown as Parameters<typeof fragmenteAusTwin>[0]
    const fr = fragmenteAusTwin(doc)
    expect(fr.map((f) => [f.name, f.variant ?? null, f.pageNumber ?? null])).toEqual([
      ['page_002.jpeg', 'page-render', 2], ['preview_002.jpg', 'preview', 2], ['img-0.jpeg', null, null], ['page_003.jpeg', 'page-render', 3],
    ])
    expect(nachSeite(fr, 2, 'page-render')).toBe('https://b/p2')
    expect(nachSeite(fr, 2, 'thumbnail')).toBe('https://b/v2')
  })
})
