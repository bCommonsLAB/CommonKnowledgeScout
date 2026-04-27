/**
 * Characterization Tests fuer src/lib/chat/facets.ts.
 * Welle 2.3 Schritt 3 — pure Funktionen (deprecated, aber getestet).
 */

import { describe, expect, it } from 'vitest'
import {
  extractTopLevelFacetsFromMeta,
  composeDocSummaryText,
} from '@/lib/chat/facets'
import type { FacetDef } from '@/lib/chat/dynamic-facets'

const TAG_DEF: FacetDef = {
  metaKey: 'tags',
  type: 'string[]',
  label: 'Tags',
} as FacetDef

const AUTHOR_DEF: FacetDef = {
  metaKey: 'authors',
  type: 'string[]',
  label: 'Autoren',
} as FacetDef

const TITLE_DEF: FacetDef = {
  metaKey: 'title',
  type: 'string',
  label: 'Titel',
} as FacetDef

describe('extractTopLevelFacetsFromMeta', () => {
  it('liefert leeres Objekt wenn meta undefined', () => {
    expect(extractTopLevelFacetsFromMeta(undefined, [TAG_DEF])).toEqual({})
  })
  it('liefert leeres Objekt wenn meta nicht-objekt', () => {
    expect(extractTopLevelFacetsFromMeta(null as never, [TAG_DEF])).toEqual({})
  })
  it('extrahiert vorhandene defs', () => {
    const meta = { tags: ['a', 'b'], authors: ['x'] }
    const r = extractTopLevelFacetsFromMeta(meta, [TAG_DEF, AUTHOR_DEF])
    expect(r.tags).toEqual(['a', 'b'])
    expect(r.authors).toEqual(['x'])
  })
  it('ignoriert undefined-Werte', () => {
    const meta = { tags: ['a'] }
    const r = extractTopLevelFacetsFromMeta(meta, [TAG_DEF, AUTHOR_DEF])
    expect(r).toEqual({ tags: ['a'] })
  })
})

describe('composeDocSummaryText', () => {
  it('liefert null wenn meta undefined', () => {
    expect(composeDocSummaryText(undefined)).toBeNull()
  })
  it('liefert null wenn meta leer', () => {
    expect(composeDocSummaryText({})).toBeNull()
  })
  it('baut Text mit Titel + Summary', () => {
    const r = composeDocSummaryText({ title: 'T', summary: 'S' })
    expect(r).toContain('Titel: T')
    expect(r).toContain('Zusammenfassung: S')
  })
  it('nutzt Hardcoded-Fallback ohne defs (authors + tags)', () => {
    const r = composeDocSummaryText({
      title: 'T',
      authors: ['A1', 'A2'],
      tags: ['t1'],
    })
    expect(r).toContain('Autoren: A1, A2')
    expect(r).toContain('Tags: t1')
  })
  it('nutzt dynamic defs wenn uebergeben', () => {
    const r = composeDocSummaryText(
      { title: 'T', tags: ['t1'], custom: 'c-val' },
      [
        TAG_DEF,
        { metaKey: 'custom', type: 'string', label: 'Custom' } as FacetDef,
      ],
    )
    expect(r).toContain('Tags: t1')
    expect(r).toContain('Custom: c-val')
  })
  it('liefert null wenn nur leere Felder', () => {
    expect(composeDocSummaryText({ title: '', authors: [] })).toBeNull()
  })
})
