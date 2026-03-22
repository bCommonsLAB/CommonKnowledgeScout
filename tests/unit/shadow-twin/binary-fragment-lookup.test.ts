/**
 * @fileoverview Tests für Hash-/Alias-Auflösung von Binary-Fragmenten (Transkript ↔ Vault-Name).
 */

import { describe, it, expect } from 'vitest'
import { matchBinaryFragmentByLookupName } from '@/lib/shadow-twin/binary-fragment-lookup'

describe('matchBinaryFragmentByLookupName', () => {
  const fragments = [
    {
      name: 'img-1.jpeg',
      hash: '6fa84ee2906d0017',
      mimeType: 'image/jpeg',
    },
    {
      name: 'preview_001.png',
      hash: 'deadbeef',
      originalName: 'legacy.png',
      mimeType: 'image/png',
    },
  ]

  it('findet nach kanonischem name', () => {
    expect(matchBinaryFragmentByLookupName(fragments, 'img-1.jpeg')?.name).toBe('img-1.jpeg')
  })

  it('findet nach hash.jpeg (Transkript-Form)', () => {
    expect(matchBinaryFragmentByLookupName(fragments, '6fa84ee2906d0017.jpeg')?.name).toBe('img-1.jpeg')
  })

  it('findet nach letztem URL-Segment (Mongo oft ohne hash-Feld)', () => {
    const fr = [
      {
        name: 'img-0.jpeg',
        url: 'https://example.blob.core.windows.net/books/326c3b8ce2b1ad76.jpeg',
      },
    ]
    expect(matchBinaryFragmentByLookupName(fr, '326c3b8ce2b1ad76.jpeg')?.name).toBe('img-0.jpeg')
  })

  it('findet nach originalName', () => {
    expect(matchBinaryFragmentByLookupName(fragments, 'legacy.png')?.name).toBe('preview_001.png')
  })

  it('gibt null bei Unbekannt', () => {
    expect(matchBinaryFragmentByLookupName(fragments, 'nope.jpg')).toBeNull()
    expect(matchBinaryFragmentByLookupName([], 'img-1.jpeg')).toBeNull()
  })
})
