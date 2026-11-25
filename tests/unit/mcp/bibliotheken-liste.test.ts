/**
 * @fileoverview Tests: Zeilen von bibliotheken_auflisten — eigene und geteilte Libraries.
 *
 * Befund 25.11.2026: Ein eingeladener Mitarbeiter sah ueber die Bruecke keine Library.
 */

import { describe, it, expect } from 'vitest'
import { bibliothekenZeilen, type GeteilteLibrary } from '@/lib/mcp/bibliotheken-liste'
import type { Library } from '@/types/library'

function lib(id: string, label: string, slugName?: string): Library {
  return { id, label, config: slugName ? { publicPublishing: { slugName } } : {} } as unknown as Library
}

function geteilt(id: string, label: string, accessRole: 'co-creator' | 'reader', slugName?: string): GeteilteLibrary {
  return { ...lib(id, label, slugName), accessRole }
}

describe('bibliothekenZeilen', () => {
  it('nennt geteilte Libraries mit ihrer Rolle hinter den eigenen', () => {
    const zeilen = bibliothekenZeilen(
      [lib('a', 'Eigene')],
      [geteilt('b', 'Team-Seite', 'co-creator', 'team'), geteilt('c', 'Lesestoff', 'reader')],
    )
    expect(zeilen.map((z) => [z.id, z.rolle])).toEqual([['a', 'eigene'], ['b', 'co-creator'], ['c', 'reader']])
    expect(zeilen[1].slug).toBe('team')
  })

  it('ein Konto ohne eigene Library sieht die geteilten', () => {
    const zeilen = bibliothekenZeilen([], [geteilt('b', 'Team-Seite', 'co-creator')])
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toMatchObject({ id: 'b', name: 'Team-Seite', rolle: 'co-creator', archivpflege: false })
  })

  it('eine geteilte Library veraendert die Slugs der eigenen nicht', () => {
    const allein = bibliothekenZeilen([lib('a', 'Eigene', 'seite')], [])
    const mitGeteilter = bibliothekenZeilen([lib('a', 'Eigene', 'seite')], [geteilt('b', 'Fremde', 'reader', 'seite')])
    expect(mitGeteilter[0]).toEqual(allein[0])
    expect(mitGeteilter[0].slugKonflikt).toBeUndefined()
  })

  it('eine Library, die zugleich eigen und geteilt gemeldet wird, steht nur einmal da', () => {
    const zeilen = bibliothekenZeilen([lib('a', 'Eigene')], [geteilt('a', 'Eigene', 'co-creator')])
    expect(zeilen.map((z) => z.rolle)).toEqual(['eigene'])
  })
})
