import { describe, it, expect } from 'vitest'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import type { Library } from '@/types/library'

/**
 * Die GET-Route /api/chat/[libraryId]/facets nutzt dieselbe Auswahl:
 * nur Facetten mit visible===true erscheinen in der Filter-Sidebar.
 *
 * Seit dem Basis-Feld-Contract (base-fields.ts) stellt parseFacetDefs die
 * verbindlichen Basis-Facetten (date, authors, source, tags) IMMER voran und
 * kanonisch dar — sie sind nicht entfernbar. Zusaetzliche Facetten folgen in
 * Config-Reihenfolge; ihre `visible`-Flagge steuert die Sidebar.
 */
describe('Facetten: Sichtbarkeit für Filter-Navigation', () => {
  it('unsichtbare Nicht-Basis-Facetten werden ausgefiltert; Basis-Facetten sind immer sichtbar und zuerst', () => {
    const lib = {
      id: 'test-lib-visible',
      config: {
        chat: {
          gallery: {
            facets: [
              { metaKey: 'commercialStatus', label: 'Commercial', type: 'string', multi: true, visible: false },
              { metaKey: 'year', label: 'Year', type: 'number', multi: true, visible: true },
            ],
          },
        },
      },
    } as unknown as Library

    const defs = parseFacetDefs(lib)
    const visibleDefs = defs.filter((d) => d.visible)

    // Basis-Facetten zuerst, dann Nicht-Basis-Facetten in Config-Reihenfolge.
    expect(defs.map((d) => d.metaKey)).toEqual(['date', 'authors', 'source', 'tags', 'commercialStatus', 'year'])
    // commercialStatus (visible:false) faellt raus; year + alle Basis-Facetten bleiben.
    expect(visibleDefs.map((d) => d.metaKey)).toEqual(['date', 'authors', 'source', 'tags', 'year'])
  })

  it('Basis-Facetten sind nicht entfernbar und kanonisch (Anwender kann sie nicht aushebeln)', () => {
    const lib = {
      id: 'test-lib-mandatory',
      config: {
        chat: {
          gallery: {
            facets: [
              // Anwender versucht, 'date' umzutypisieren/zu verstecken und laesst tags/authors/source weg.
              { metaKey: 'date', label: 'Falsch', type: 'string', multi: true, visible: false },
              { metaKey: 'extra', label: 'Extra', type: 'string', multi: true, visible: true },
            ],
          },
        },
      },
    } as unknown as Library

    const defs = parseFacetDefs(lib)
    const byKey = Object.fromEntries(defs.map((d) => [d.metaKey, d]))

    for (const key of ['date', 'authors', 'source', 'tags']) {
      expect(byKey[key]).toBeTruthy()
      expect(byKey[key].mandatory).toBe(true)
    }
    // Kanonisch erzwungen: User-Typ 'string' und visible:false fuer 'date' werden ignoriert.
    expect(byKey.date.type).toBe('date')
    expect(byKey.date.visible).toBe(true)
    // Zusaetzliche (Nicht-Basis-)Facette bleibt erhalten.
    expect(byKey.extra).toBeTruthy()
    expect(byKey.extra.mandatory).toBeUndefined()
  })
})
