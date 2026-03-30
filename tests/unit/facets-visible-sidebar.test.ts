import { describe, it, expect } from 'vitest'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import type { Library } from '@/types/library'

/**
 * Die GET-Route /api/chat/[libraryId]/facets nutzt dieselbe Auswahl:
 * nur Facetten mit visible===true erscheinen in der Filter-Sidebar.
 */
describe('Facetten: Sichtbarkeit für Filter-Navigation', () => {
  it('parseFacetDefs: unsichtbare Facetten (visible false) werden für Sidebar ausgefiltert', () => {
    const lib = {
      id: 'test-lib',
      config: {
        chat: {
          gallery: {
            facets: [
              { metaKey: 'date', label: 'Datum', type: 'date', multi: false, visible: false },
              { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
            ],
          },
        },
      },
    } as unknown as Library

    const defs = parseFacetDefs(lib)
    const visibleDefs = defs.filter((d) => d.visible)

    expect(defs.map((d) => d.metaKey)).toEqual(['date', 'year'])
    expect(visibleDefs.map((d) => d.metaKey)).toEqual(['year'])
  })
})
