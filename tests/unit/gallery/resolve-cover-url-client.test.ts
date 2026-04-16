import { describe, expect, it } from 'vitest'
import {
  coverRefNeedsApiResolution,
  leafFileNameForSiblingMatch,
} from '@/lib/gallery/resolve-cover-url-client'

describe('coverRefNeedsApiResolution', () => {
  it('erkennt http(s)-URLs als bereits auflösbar', () => {
    expect(coverRefNeedsApiResolution('https://example.com/x.jpg')).toBe(false)
    expect(coverRefNeedsApiResolution('http://local/a.png')).toBe(false)
  })

  it('erkennt streaming-url-Pfade', () => {
    expect(
      coverRefNeedsApiResolution(
        '/api/storage/streaming-url?libraryId=lib&fileId=id'
      )
    ).toBe(false)
  })

  it('markiert bloße Dateinamen für API-Auflösung', () => {
    expect(coverRefNeedsApiResolution('9106_1_basecolor.jpg')).toBe(true)
    expect(coverRefNeedsApiResolution('  foo.png ')).toBe(true)
  })
})

describe('leafFileNameForSiblingMatch', () => {
  it('liefert den letzten Pfadteil für normale Pfade', () => {
    expect(leafFileNameForSiblingMatch('ordner/foo.jpg')).toBe('foo.jpg')
    expect(leafFileNameForSiblingMatch('foo.jpg')).toBe('foo.jpg')
  })

  it('liefert null für Shadow-Twin-Relative (_Quelle/fragment)', () => {
    expect(leafFileNameForSiblingMatch('_Quelle.pdf/img-0.jpeg')).toBe(null)
  })
})
