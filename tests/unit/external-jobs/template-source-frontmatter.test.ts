import { describe, expect, it } from 'vitest'
import { extractForwardedTemplateSourceFrontmatter } from '@/lib/external-jobs/template-source-frontmatter'

describe('extractForwardedTemplateSourceFrontmatter', () => {
  it('reicht _source_files als Array durch', () => {
    expect(extractForwardedTemplateSourceFrontmatter({
      _source_files: ['a.pdf', 'b.pdf'],
      kind: 'composite-transcript',
      createdAt: '2026-03-22T21:14:50.894Z',
    })).toEqual({
      _source_files: ['a.pdf', 'b.pdf'],
    })
  })

  it('reicht _source_files als serialisierten String durch', () => {
    expect(extractForwardedTemplateSourceFrontmatter({
      _source_files: '["a.pdf","b.pdf"]',
      kind: 'composite-transcript',
    })).toEqual({
      _source_files: ['a.pdf', 'b.pdf'],
    })
  })

  it('normalisiert doppelt serialisierten YAML-String ins Array', () => {
    expect(extractForwardedTemplateSourceFrontmatter({
      _source_files: '[\\"a.pdf\\",\\"b.pdf\\"]',
      kind: 'composite-transcript',
    })).toEqual({
      _source_files: ['a.pdf', 'b.pdf'],
    })
  })

  it('ignoriert transcript-spezifische Felder ohne _source_files', () => {
    expect(extractForwardedTemplateSourceFrontmatter({
      kind: 'composite-transcript',
      createdAt: '2026-03-22T21:14:50.894Z',
    })).toEqual({})
  })
})
