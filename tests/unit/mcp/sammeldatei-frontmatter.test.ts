/**
 * Welle E — Frontmatter der neuen Sammeldatei: title, _include_self und
 * _media_files ergaenzt, flach, ueber den zentralen Serializer; fremde Form wirft.
 */
import { describe, it, expect } from 'vitest'
import { ergaenzeSammeldateiFrontmatter } from '@/lib/mcp/sammeldatei-frontmatter'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

// Dieselbe Form wie buildCompositeReference: Listen als JSON-Arrays auf einer Zeile.
const REFERENZ = '---\nkind: composite-transcript\n_source_files: ["Rede.m4a","Folien.pdf"]\n_media_files: ["bild1.png"]\n---\n\n# Quellen\n\n- [[Rede.m4a]]\n'

describe('ergaenzeSammeldateiFrontmatter', () => {
  it('ergaenzt Titel, _include_self und weitere Medien ohne Dubletten', () => {
    const { meta, body } = parseFrontmatter(ergaenzeSammeldateiFrontmatter(REFERENZ, { titel: 'Vortrag 1', includeSelf: true, medien: ['bild1.png', 'flyer.jpg'] }))
    expect(meta).toMatchObject({ kind: 'composite-transcript', title: 'Vortrag 1', _include_self: true, _media_files: ['bild1.png', 'flyer.jpg'] })
    expect(meta._source_files).toEqual(['Rede.m4a', 'Folien.pdf'])
    expect(body).toContain('[[Rede.m4a]]')
  })

  it('laesst ohne Zusatz alles wie es ist und weist fremde Form ab', () => {
    expect(parseFrontmatter(ergaenzeSammeldateiFrontmatter(REFERENZ, {})).meta).not.toHaveProperty('title')
    expect(() => ergaenzeSammeldateiFrontmatter('---\ntitle: x\n---\nText', { titel: 'y' })).toThrow(/composite-transcript/)
    expect(() => ergaenzeSammeldateiFrontmatter('---\nkind: composite-transcript\n---\nText', { titel: 'y' })).toThrow(/lesbare _source_files/)
  })
})
