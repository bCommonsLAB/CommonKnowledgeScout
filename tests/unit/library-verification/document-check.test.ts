import { describe, it, expect } from 'vitest'
import { checkDocument, resolveDetailViewType } from '@/lib/library-verification/document-check'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type { VerifiableDocument } from '@/lib/library-verification/types'

const facetDefs: FacetDef[] = [
  { metaKey: 'date', type: 'date', multi: true, visible: true },
  { metaKey: 'authors', type: 'string[]', multi: true, visible: true },
  { metaKey: 'source', type: 'string', multi: true, visible: true },
  { metaKey: 'tags', type: 'string[]', multi: true, visible: true },
]

function cleanBook(extra: Record<string, unknown> = {}): VerifiableDocument {
  return {
    fileId: 'f1',
    docMetaJson: {
      detailViewType: 'book',
      title: 'Titel',
      date: '2024-01-01',
      authors: ['Autor A'],
      language: 'de',
      targetLanguage: 'de',
      source: 'Quelle',
      tags: ['tag1'],
      ...extra,
    },
  }
}

const ctx = { libraryDetailViewType: 'book', facetDefs }

describe('resolveDetailViewType', () => {
  it('bevorzugt gueltigen per-Dokument-Typ', () => {
    const r = resolveDetailViewType({ detailViewType: 'session' }, 'book')
    expect(r.viewType).toBe('session')
    expect(r.issues).toHaveLength(0)
  })

  it('faellt auf Library-Default zurueck und meldet ungueltigen Typ', () => {
    const r = resolveDetailViewType({ detailViewType: 'nope' }, 'book')
    expect(r.viewType).toBe('book')
    expect(r.issues.map((i) => i.code)).toContain('invalid-detail-view-type')
  })

  it('meldet undeterminierbaren Typ ohne Default', () => {
    const r = resolveDetailViewType({}, undefined)
    expect(r.viewType).toBeUndefined()
    expect(r.issues.map((i) => i.code)).toEqual(['undetermined-detail-view-type'])
  })
})

describe('checkDocument', () => {
  it('akzeptiert ein sauberes Dokument', () => {
    const r = checkDocument(cleanBook(), ctx)
    expect(r.ok).toBe(true)
    expect(r.issues).toHaveLength(0)
    expect(r.detailViewType).toBe('book')
  })

  it('meldet fehlendes Basis-Feld als Fehler', () => {
    const doc = cleanBook()
    delete doc.docMetaJson.source
    const r = checkDocument(doc, ctx)
    expect(r.ok).toBe(false)
    const issue = r.issues.find((i) => i.code === 'missing-base-field')
    expect(issue).toMatchObject({ field: 'source', severity: 'error', autoFixable: false })
  })

  it('meldet fehlendes inhaltliches Pflichtfeld als Fehler', () => {
    const doc = cleanBook({ detailViewType: 'climateAction' })
    const r = checkDocument(doc, { libraryDetailViewType: 'climateAction', facetDefs })
    const issue = r.issues.find((i) => i.code === 'missing-required-field' && i.field === 'category')
    expect(issue?.severity).toBe('error')
  })

  it('stuft fehlendes technisches Pflichtfeld als Warnung ein', () => {
    const doc = cleanBook()
    delete doc.docMetaJson.targetLanguage
    const r = checkDocument(doc, ctx)
    const issue = r.issues.find((i) => i.code === 'missing-required-field' && i.field === 'targetLanguage')
    expect(issue?.severity).toBe('warning')
  })

  it('meldet echten Facetten-Typ-Konflikt als nicht reparierbar', () => {
    const doc = cleanBook({ authors: { not: 'an array' } })
    const r = checkDocument(doc, ctx)
    const issue = r.issues.find((i) => i.code === 'facet-type-mismatch')
    expect(issue).toMatchObject({ field: 'authors', autoFixable: false })
  })

  it('meldet unnormalisierten Wert als auto-fixbare Warnung', () => {
    const doc = cleanBook({ tags: 'a,b,c' })
    const r = checkDocument(doc, ctx)
    const issue = r.issues.find((i) => i.code === 'unnormalized-value')
    expect(issue).toMatchObject({ field: 'tags', severity: 'warning', autoFixable: true })
  })
})
