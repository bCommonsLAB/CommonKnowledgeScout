import { describe, it, expect, vi } from 'vitest'
import type { Library } from '@/types/library'
import {
  commonFacetDefs,
  facetDefsForType,
  resolveFacetScope,
  viewTypeMatchFilter,
  dedupeValidTypes,
  UnknownDetailViewTypeError,
  DETAIL_VIEW_TYPE_PATH,
} from '@/lib/chat/facet-scope'

interface FacetSeed {
  metaKey: string
  type?: string
  multi?: boolean
  visible?: boolean
}

let counter = 0
function makeLibrary(facets: FacetSeed[]): Library {
  counter += 1
  return {
    id: `lib-${counter}`,
    config: { chat: { gallery: { detailViewType: 'book', facets } } },
  } as unknown as Library
}

// year/topics/docType: in book UND session → gemeinsam.
// pages: nur book. track: nur session. customX: in keinem Registry-Typ → global.
const CONFIGURED: FacetSeed[] = [
  { metaKey: 'year', type: 'integer-range' },
  { metaKey: 'topics', type: 'string[]' },
  { metaKey: 'docType', type: 'string' },
  { metaKey: 'pages', type: 'number' },
  { metaKey: 'track', type: 'string' },
  { metaKey: 'customX', type: 'string' },
]

const keys = (defs: { metaKey: string }[]) => defs.map((d) => d.metaKey)

describe('commonFacetDefs', () => {
  it('nimmt Basis + in ALLEN Typen vorhandene + globale; laesst typ-spezifische weg', () => {
    const lib = makeLibrary(CONFIGURED)
    const k = keys(commonFacetDefs(lib, ['book', 'session']))
    // Basis-Facetten immer dabei
    for (const base of ['date', 'authors', 'source', 'tags']) expect(k).toContain(base)
    // gemeinsam
    expect(k).toEqual(expect.arrayContaining(['year', 'topics', 'docType']))
    // custom (in keinem Typ) bleibt global sichtbar
    expect(k).toContain('customX')
    // typ-spezifisch raus
    expect(k).not.toContain('pages')
    expect(k).not.toContain('track')
  })

  it('ohne vorhandene Typen bleibt die volle konfigurierte Liste', () => {
    const lib = makeLibrary(CONFIGURED)
    const k = keys(commonFacetDefs(lib, []))
    expect(k).toEqual(expect.arrayContaining(['year', 'pages', 'track', 'customX']))
  })

  it('verwirft ungueltige Typen (mit Warnung) und scoped auf die gueltigen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lib = makeLibrary(CONFIGURED)
    const k = keys(commonFacetDefs(lib, ['book', 'bogus']))
    expect(warn).toHaveBeenCalled()
    // nur book → pages (book-Feld) bleibt, track (session) nicht
    expect(k).toContain('pages')
    expect(k).not.toContain('track')
    warn.mockRestore()
  })
})

describe('facetDefsForType', () => {
  it('session: Basis + Session-Felder + global, ohne book-only', () => {
    const lib = makeLibrary(CONFIGURED)
    const k = keys(facetDefsForType(lib, 'session'))
    expect(k).toEqual(expect.arrayContaining(['date', 'year', 'topics', 'docType', 'track', 'customX']))
    expect(k).not.toContain('pages')
  })

  it('book: enthaelt pages, nicht track', () => {
    const lib = makeLibrary(CONFIGURED)
    const k = keys(facetDefsForType(lib, 'book'))
    expect(k).toContain('pages')
    expect(k).not.toContain('track')
  })

  it('wirft bei ungueltigem Typ', () => {
    const lib = makeLibrary(CONFIGURED)
    expect(() => facetDefsForType(lib, 'bogus')).toThrow(UnknownDetailViewTypeError)
  })
})

describe('viewTypeMatchFilter', () => {
  it('Nicht-Default: exakter Typ-Match', () => {
    expect(viewTypeMatchFilter('session', 'book')).toEqual({ [DETAIL_VIEW_TYPE_PATH]: 'session' })
  })

  it('Default-Typ: bezieht Dokumente ohne detailViewType mit ein', () => {
    const f = viewTypeMatchFilter('book', 'book') as { $or: unknown[] }
    expect(Array.isArray(f.$or)).toBe(true)
    expect(f.$or).toEqual(
      expect.arrayContaining([
        { [DETAIL_VIEW_TYPE_PATH]: 'book' },
        { [DETAIL_VIEW_TYPE_PATH]: { $exists: false } },
        { [DETAIL_VIEW_TYPE_PATH]: null },
      ]),
    )
  })

  it('wirft bei ungueltigem Typ', () => {
    expect(() => viewTypeMatchFilter('bogus', 'book')).toThrow(UnknownDetailViewTypeError)
  })
})

describe('dedupeValidTypes', () => {
  it('dedupliziert und verwirft ungueltige (mit Warnung)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(dedupeValidTypes(['book', 'book', 'session', 'bogus'])).toEqual(['book', 'session'])
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('resolveFacetScope', () => {
  it('mit gewaehltem Typ: typ-Facetten + strenger Typ-Filter', () => {
    const lib = makeLibrary(CONFIGURED)
    const scope = resolveFacetScope({
      library: lib,
      selectedType: 'session',
      presentTypes: ['book', 'session'],
      libraryDefaultType: 'book',
    })
    expect(scope.selectedType).toBe('session')
    expect(scope.typeFilter).toEqual({ [DETAIL_VIEW_TYPE_PATH]: 'session' })
    expect(keys(scope.defs)).toContain('track')
  })

  it('ohne Typ: gemeinsame Facetten, kein Typ-Filter', () => {
    const lib = makeLibrary(CONFIGURED)
    const scope = resolveFacetScope({
      library: lib,
      selectedType: null,
      presentTypes: ['book', 'session'],
      libraryDefaultType: 'book',
    })
    expect(scope.selectedType).toBeNull()
    expect(scope.typeFilter).toBeNull()
    expect(keys(scope.defs)).not.toContain('track')
  })

  it('wirft bei ungueltigem gewaehlten Typ', () => {
    const lib = makeLibrary(CONFIGURED)
    expect(() =>
      resolveFacetScope({
        library: lib,
        selectedType: 'bogus',
        presentTypes: [],
        libraryDefaultType: 'book',
      }),
    ).toThrow(UnknownDetailViewTypeError)
  })
})
