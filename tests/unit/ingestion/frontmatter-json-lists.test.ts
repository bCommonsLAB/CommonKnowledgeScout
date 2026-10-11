/**
 * Welle J1: Listenfelder aus dem flachen Twin-Frontmatter (JSON-Text) beim
 * Ingest als Listen lesen — `src/lib/ingestion/frontmatter-json-lists.ts`.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { parseJsonListFields, JSON_LIST_FIELDS } from '@/lib/ingestion/frontmatter-json-lists'

describe('parseJsonListFields', () => {
  it('macht aus slides als JSON-Text eine Liste von Objekten', () => {
    const slides = [{ page_num: 1, title: 'Start', image_url: 'preview_001.jpg' }, { page_num: 2, title: 'Zwei' }]
    const r = parseJsonListFields({ title: 'Vortrag', slides: JSON.stringify(slides) })
    expect(r.parsed).toEqual(['slides'])
    expect(r.fehlerhaft).toEqual([])
    expect(r.meta.slides).toEqual(slides)
    expect(r.meta.title).toBe('Vortrag')
  })

  it('laesst Listen und andere Werte unveraendert und kopiert das Objekt', () => {
    const input = { slides: [{ page_num: 1 }], summary: '[nicht json', pages: 3 }
    const r = parseJsonListFields(input)
    expect(r.parsed).toEqual([])
    expect(r.meta).toEqual(input)
    expect(r.meta).not.toBe(input)
  })

  it('meldet unlesbaren JSON-Text und laesst den String stehen', () => {
    const r = parseJsonListFields({ slides: '[{"page_num": 1,]' })
    expect(r.parsed).toEqual([])
    expect(r.fehlerhaft).toHaveLength(1)
    expect(r.fehlerhaft[0].field).toBe('slides')
    expect(typeof r.meta.slides).toBe('string')
  })

  it('lehnt JSON ab, das keine Liste ist', () => {
    const r = parseJsonListFields({ attachments_url: '["a.pdf"]', galleryImageUrls: '[1]' }, ['attachments_url', 'galleryImageUrls'])
    expect(r.parsed).toEqual(['attachments_url', 'galleryImageUrls'])
    expect(r.meta.attachments_url).toEqual(['a.pdf'])
  })

  it('parst nur die genannten Felder, nicht beliebige Strings', () => {
    const r = parseJsonListFields({ summary: '["sieht aus wie JSON"]', slides: '[]' }, JSON_LIST_FIELDS)
    expect(r.meta.summary).toBe('["sieht aus wie JSON"]')
    expect(r.meta.slides).toEqual([])
  })
})
