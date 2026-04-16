import { describe, expect, test } from 'vitest'
import { mapItemToDocCardMeta } from '@/lib/gallery/types'
import type { Item } from '@/types/item'

describe('mapItemToDocCardMeta', () => {
  test('maps per-document detailViewType from item.meta', () => {
    const item: Item = {
      id: 'file-1',
      libraryId: 'lib-1',
      user: 'user@example.com',
      fileName: 'file.md',
      docType: 'event',
      source: 'upload',
      meta: { title: 'T', detailViewType: 'session', slug: 's' },
      markdown: '# hi',
      chaptersCount: 0,
      chunkCount: 1,
      upsertedAt: new Date().toISOString(),
    }

    const mapped = mapItemToDocCardMeta(item)
    expect(mapped.detailViewType).toBe('session')
    expect(mapped.docType).toBe('event')
    expect(mapped.slug).toBe('s')
  })

  test('maps textur_code for divaTexture gallery tiles', () => {
    const item: Item = {
      id: 'file-2',
      libraryId: 'lib-1',
      user: 'user@example.com',
      fileName: 'tex.md',
      docType: 'document',
      source: 'upload',
      meta: {
        title: 'Stoff',
        detailViewType: 'divaTexture',
        textur_code: '9106_1',
        coverImageUrl: '9106_1_basecolor.jpg',
      },
      markdown: '---\n---\n',
      chaptersCount: 0,
      chunkCount: 1,
      upsertedAt: new Date().toISOString(),
    }
    const mapped = mapItemToDocCardMeta(item)
    expect(mapped.textur_code).toBe('9106_1')
    expect(mapped.coverImageUrl).toBe('9106_1_basecolor.jpg')
  })
})

