import { describe, expect, it, vi } from 'vitest'
import {
  normalizeGalleryCardDensity,
  itemsGridClassForDensity,
  groupedItemsGridClassForDensity,
  galleryCardDensityStorageKey,
} from '@/lib/gallery/gallery-card-density'

describe('normalizeGalleryCardDensity', () => {
  it('akzeptiert compact und comfortable', () => {
    expect(normalizeGalleryCardDensity('compact')).toBe('compact')
    expect(normalizeGalleryCardDensity('comfortable')).toBe('comfortable')
  })

  it('mappt unbekannte Werte auf comfortable und warnt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeGalleryCardDensity('dense')).toBe('comfortable')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('mappt undefined/leer auf comfortable ohne Warnung bei undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeGalleryCardDensity(undefined)).toBe('comfortable')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('itemsGridClassForDensity / groupedItemsGridClassForDensity', () => {
  it('liefert unterschiedliche Klassenstrings für compact vs. comfortable', () => {
    const a = itemsGridClassForDensity('comfortable')
    const b = itemsGridClassForDensity('compact')
    expect(a).not.toBe(b)
    expect(a).toContain('gap-4')
    expect(b).toContain('gap-3')

    const ga = groupedItemsGridClassForDensity('comfortable')
    const gb = groupedItemsGridClassForDensity('compact')
    expect(ga).not.toBe(gb)
  })
})

describe('galleryCardDensityStorageKey', () => {
  it('prefixt die Library-ID stabil', () => {
    expect(galleryCardDensityStorageKey('lib-1')).toBe('galleryCardDensity:lib-1')
  })
})
