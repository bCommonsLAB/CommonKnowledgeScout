/**
 * Characterization Tests fuer src/lib/templates/detail-view-type-utils.ts.
 * Welle 2.2 Schritt 3.
 */

import { describe, expect, it } from 'vitest'
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils'

describe('getDetailViewType', () => {
  it('liefert Default "book" wenn weder Frontmatter noch Library-Config', () => {
    expect(getDetailViewType({})).toBe('book')
  })

  it('akzeptiert gueltigen detailViewType aus Frontmatter', () => {
    expect(getDetailViewType({ detailViewType: 'session' })).toBe('session')
    expect(getDetailViewType({ detailViewType: 'testimonial' })).toBe('testimonial')
    expect(getDetailViewType({ detailViewType: 'blog' })).toBe('blog')
    expect(getDetailViewType({ detailViewType: 'climateAction' })).toBe('climateAction')
    expect(getDetailViewType({ detailViewType: 'divaDocument' })).toBe('divaDocument')
    expect(getDetailViewType({ detailViewType: 'divaTexture' })).toBe('divaTexture')
  })

  it('lehnt unbekannten detailViewType ab und faellt zurueck', () => {
    expect(getDetailViewType({ detailViewType: 'unbekannt' })).toBe('book')
  })

  it('faellt auf libraryConfig.gallery.detailViewType zurueck', () => {
    expect(
      getDetailViewType({}, { gallery: { detailViewType: 'session' } } as never),
    ).toBe('session')
  })

  it('Frontmatter hat Vorrang vor libraryConfig', () => {
    expect(
      getDetailViewType(
        { detailViewType: 'blog' },
        { gallery: { detailViewType: 'session' } } as never,
      ),
    ).toBe('blog')
  })

  it('lehnt unbekannten libraryConfig-Wert ab', () => {
    expect(
      getDetailViewType({}, { gallery: { detailViewType: 'unbekannt' } } as never),
    ).toBe('book')
  })

  it('lehnt nicht-string detailViewType in Frontmatter ab', () => {
    expect(getDetailViewType({ detailViewType: 42 })).toBe('book')
    expect(getDetailViewType({ detailViewType: null })).toBe('book')
  })
})
