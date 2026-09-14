// @vitest-environment node
/**
 * Flaches Frontmatter mit Listen: einzeilige JSON-Listen und -Objekte werden fuer
 * JEDEN Schluessel gelesen, nicht nur fuer die feste jsonKeys-Liste. Anlass:
 * `verwandte_musterkarten: ["a","b"]` wurde beim Re-Save zum Text `"[\"a\",\"b\"]"`.
 */
import { describe, it, expect } from 'vitest'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'

describe('parseSecretaryMarkdownStrict: Listen jedes Schluessels', () => {
  it('liest einzeilige JSON-Listen und -Objekte, laesst Nicht-JSON als Text', () => {
    const md = [
      '---',
      'verwandte_musterkarten: ["a","b"]',
      'prozessschritte: []',
      'objekt: {"x":1}',
      'text: [kein json',
      'tags: ["t1"]',
      'pages: 2',
      '---',
      'Body',
    ].join('\n')
    const { meta } = parseSecretaryMarkdownStrict(md)
    expect(meta.verwandte_musterkarten).toEqual(['a', 'b'])
    expect(meta.prozessschritte).toEqual([])
    expect(meta.objekt).toEqual({ x: 1 })
    expect(meta.text).toBe('[kein json')
    expect(meta.tags).toEqual(['t1'])
    expect(meta.pages).toBe(2)
  })
})
