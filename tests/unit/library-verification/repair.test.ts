import { describe, it, expect } from 'vitest'
import { checkDocument } from '@/lib/library-verification/document-check'
import { computeRepairPlan } from '@/lib/library-verification/repair'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type { VerifiableDocument } from '@/lib/library-verification/types'

const facetDefs: FacetDef[] = [
  { metaKey: 'date', type: 'date', multi: true, visible: true },
  { metaKey: 'authors', type: 'string[]', multi: true, visible: true },
  { metaKey: 'source', type: 'string', multi: true, visible: true },
  { metaKey: 'tags', type: 'string[]', multi: true, visible: true },
]

function doc(extra: Record<string, unknown> = {}): VerifiableDocument {
  return {
    fileId: 'f1',
    docMetaJson: {
      detailViewType: 'book',
      title: 'Titel',
      date: '2024-01-01',
      authors: ['A'],
      language: 'de',
      targetLanguage: 'de',
      source: 'Quelle',
      tags: ['t'],
      ...extra,
    },
  }
}

const ctx = { libraryDetailViewType: 'book', facetDefs }

describe('computeRepairPlan', () => {
  it('normalisiert auto-fixbare Felder', () => {
    const d = doc({ tags: 'a,b' })
    const plan = computeRepairPlan(d, checkDocument(d, ctx), facetDefs)
    expect(plan.patch).toEqual({ tags: ['a', 'b'] })
    expect(plan.fixedFields).toEqual(['tags'])
    expect(plan.remainingIssues).toHaveLength(0)
  })

  it('laesst nicht-fixbare Befunde stehen und erfindet nichts', () => {
    const d = doc()
    delete d.docMetaJson.source
    const plan = computeRepairPlan(d, checkDocument(d, ctx), facetDefs)
    expect(plan.patch).toEqual({})
    expect(plan.fixedFields).toHaveLength(0)
    expect(plan.remainingIssues.map((i) => i.code)).toContain('missing-base-field')
  })

  it('mischt fixbare und nicht-fixbare Befunde korrekt', () => {
    const d = doc({ tags: 'a,b' })
    delete d.docMetaJson.source
    const plan = computeRepairPlan(d, checkDocument(d, ctx), facetDefs)
    expect(plan.patch).toEqual({ tags: ['a', 'b'] })
    expect(plan.remainingIssues.map((i) => i.field)).toContain('source')
  })
})
