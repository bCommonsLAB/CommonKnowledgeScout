import { describe, expect, it } from 'vitest'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'

describe('parseCompositeSourceFilesFromMeta', () => {
  it('liest ein echtes Array direkt', () => {
    expect(parseCompositeSourceFilesFromMeta({
      _source_files: ['a.pdf', 'b.pdf'],
    })).toEqual(['a.pdf', 'b.pdf'])
  })

  it('liest JSON-String-Arrays', () => {
    expect(parseCompositeSourceFilesFromMeta({
      _source_files: '["a.pdf","b.pdf"]',
    })).toEqual(['a.pdf', 'b.pdf'])
  })

  it('repariert doppelt serialisierte YAML-Strings', () => {
    expect(parseCompositeSourceFilesFromMeta({
      _source_files: '[\\"a.pdf\\",\\"b.pdf\\"]',
    })).toEqual(['a.pdf', 'b.pdf'])
  })
})
/**
 * @fileoverview Tests für `parseCompositeSourceFilesFromMeta` (Composite-Frontmatter).
 */

import { describe, it, expect } from 'vitest'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'

describe('parseCompositeSourceFilesFromMeta', () => {
  it('liest String-Array aus _source_files', () => {
    expect(
      parseCompositeSourceFilesFromMeta({
        _source_files: ['a.pdf', 'b.mp3'],
        kind: 'composite-transcript',
      })
    ).toEqual(['a.pdf', 'b.mp3'])
  })

  it('parst JSON-String _source_files', () => {
    expect(
      parseCompositeSourceFilesFromMeta({
        _source_files: '["x.pdf","y.md"]',
      })
    ).toEqual(['x.pdf', 'y.md'])
  })

  it('gibt leeres Array bei fehlendem oder ungültigem Wert zurück', () => {
    expect(parseCompositeSourceFilesFromMeta({})).toEqual([])
    expect(parseCompositeSourceFilesFromMeta({ _source_files: 12 as unknown as string })).toEqual([])
    expect(parseCompositeSourceFilesFromMeta({ _source_files: 'not-json' })).toEqual([])
  })
})
