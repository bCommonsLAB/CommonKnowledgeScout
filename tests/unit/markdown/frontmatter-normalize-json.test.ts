// @vitest-environment node
/** JSON-Text in Frontmatter-Feldern wird zu echten Listen/Objekten (normalizeJsonStringValues). */
import { describe, it, expect } from 'vitest'
import { normalizeJsonStringValues } from '@/lib/markdown/frontmatter'

describe('normalizeJsonStringValues', () => {
  it('macht aus JSON-Array-Strings Listen und laesst andere Werte in Ruhe', () => {
    const out = normalizeJsonStringValues({
      prozessschritte: '["reflektieren","kultivieren"]',
      leer: '[]',
      objekt: '{"a":1}',
      text: 'kein json',
      klammerText: '[nicht json',
      zahl: 3,
      liste: ['schon', 'liste'],
    })
    expect(out.prozessschritte).toEqual(['reflektieren', 'kultivieren'])
    expect(out.leer).toEqual([])
    expect(out.objekt).toEqual({ a: 1 })
    expect(out.text).toBe('kein json')
    expect(out.klammerText).toBe('[nicht json')
    expect(out.zahl).toBe(3)
    expect(out.liste).toEqual(['schon', 'liste'])
  })
})
