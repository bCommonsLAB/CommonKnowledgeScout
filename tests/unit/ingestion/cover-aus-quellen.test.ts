/**
 * Welle J3: Cover aus den Seitenbildern der Quellen-Twins —
 * `src/lib/ingestion/cover-aus-quellen.ts` und die Ordnung aus
 * `quellen-fragmente.ts` (reine Auswahl, ohne Mongo).
 */

import { describe, expect, it } from 'vitest'
import { waehleCover } from '@/lib/ingestion/cover-aus-quellen'
import { ordneQuellen, type Fragment, type QuellenTwin } from '@/lib/ingestion/quellen-fragmente'

function seiten(variant: 'thumbnail' | 'page-render', n: number, base: string): Fragment[] {
  const prefix = variant === 'thumbnail' ? 'preview' : 'page'
  return Array.from({ length: n }, (_, i) => ({
    name: `${prefix}_${String(i + 1).padStart(3, '0')}.jpeg`,
    url: `${base}/${prefix}_${String(i + 1).padStart(3, '0')}.jpeg`,
    variant, pageNumber: i + 1,
  }))
}

const eigener: QuellenTwin = { sourceId: 'sammel', sourceName: 'Vortrag.md', fragments: [], eigener: true }
const audio: QuellenTwin = { sourceId: 'audio', sourceName: 'Vortrag.mp3', fragments: [], eigener: false }

describe('waehleCover', () => {
  it('nimmt die zweite Seite der Folien-PDF, page-render als Cover, thumbnail als Vorschau', () => {
    const folien: QuellenTwin = {
      sourceId: 'folien', sourceName: 'Folien.pdf', eigener: false,
      fragments: [...seiten('thumbnail', 5, 'https://b/f'), ...seiten('page-render', 5, 'https://b/f')],
    }
    const flyer: QuellenTwin = { sourceId: 'flyer', sourceName: 'Einladung.pdf', eigener: false, fragments: seiten('thumbnail', 1, 'https://b/e') }
    const cover = waehleCover(ordneQuellen(eigener, [audio, flyer, folien]))
    expect(cover).toEqual({
      coverImageUrl: 'https://b/f/page_002.jpeg',
      coverThumbnailUrl: 'https://b/f/preview_002.jpeg',
      quelle: 'slides', sourceId: 'folien', sourceName: 'Folien.pdf', page: 2,
    })
  })

  it('faellt bei einseitiger Folien-PDF auf Seite 1 zurueck und nimmt thumbnail, wenn page-render fehlt', () => {
    const folien: QuellenTwin = { sourceId: 'folien', sourceName: 'Folien.pdf', eigener: false, fragments: seiten('thumbnail', 1, 'https://b/f') }
    const cover = waehleCover(ordneQuellen(eigener, [folien]))
    expect(cover?.coverImageUrl).toBe('https://b/f/preview_001.jpeg')
    expect(cover?.coverThumbnailUrl).toBeUndefined()
    expect(cover?.page).toBe(1)
    expect(cover?.quelle).toBe('slides')
  })

  it('nimmt den Flyer (erste Seite), wenn es keine Folien-PDF gibt', () => {
    const flyer: QuellenTwin = { sourceId: 'flyer', sourceName: 'Flyer Tagung.pdf', eigener: false, fragments: seiten('page-render', 2, 'https://b/e') }
    const cover = waehleCover(ordneQuellen(eigener, [audio, flyer]))
    expect(cover).toMatchObject({ coverImageUrl: 'https://b/e/page_001.jpeg', quelle: 'flyer', page: 1 })
  })

  it('liefert null ohne PDF-Quelle mit Seitenbildern und ignoriert den eigenen Twin', () => {
    const eigenerMitBildern: QuellenTwin = { ...eigener, fragments: seiten('thumbnail', 3, 'https://b/s') }
    const pdfOhneBilder: QuellenTwin = { sourceId: 'p', sourceName: 'Unterlagen.pdf', eigener: false, fragments: [] }
    expect(waehleCover(ordneQuellen(eigenerMitBildern, [audio, pdfOhneBilder]))).toBeNull()
  })
})
