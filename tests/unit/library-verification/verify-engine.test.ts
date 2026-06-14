import { describe, it, expect } from 'vitest'
import { runLibraryVerification } from '@/lib/library-verification/verify-engine'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type {
  LibraryDocumentSource,
  LibraryVerificationReport,
  VerifiableDocument,
  VerificationMode,
  VerificationProgress,
} from '@/lib/library-verification/types'

const facetDefs: FacetDef[] = [
  { metaKey: 'date', type: 'date', multi: true, visible: true },
  { metaKey: 'authors', type: 'string[]', multi: true, visible: true },
  { metaKey: 'source', type: 'string', multi: true, visible: true },
  { metaKey: 'tags', type: 'string[]', multi: true, visible: true },
]

function book(fileId: string, extra: Record<string, unknown> = {}): VerifiableDocument {
  return {
    fileId,
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

interface FakeSource extends LibraryDocumentSource {
  repairCalls: Array<{ fileId: string; patch: Record<string, unknown> }>
}

function fakeSource(docs: VerifiableDocument[]): FakeSource {
  const repairCalls: Array<{ fileId: string; patch: Record<string, unknown> }> = []
  return {
    repairCalls,
    async listDocuments() {
      return docs
    },
    async applyRepair(fileId, patch) {
      repairCalls.push({ fileId, patch })
    },
  }
}

async function drive(
  source: LibraryDocumentSource,
  mode: VerificationMode
): Promise<{ events: VerificationProgress[]; report: LibraryVerificationReport }> {
  const gen = runLibraryVerification({
    libraryId: 'lib-1',
    mode,
    libraryDetailViewType: 'book',
    facetDefs,
    source,
  })
  const events: VerificationProgress[] = []
  let next = await gen.next()
  while (!next.done) {
    events.push(next.value)
    next = await gen.next()
  }
  return { events, report: next.value }
}

describe('runLibraryVerification', () => {
  it('markiert eine saubere Library als verified', async () => {
    const { report, events } = await drive(fakeSource([book('a'), book('b')]), 'check')
    expect(report.status).toBe('verified')
    expect(report.summary).toMatchObject({ scanned: 2, ok: 2, withIssues: 0 })
    expect(report.documents).toHaveLength(0)
    expect(events[0].phase).toBe('start')
    expect(events[events.length - 1].phase).toBe('done')
  })

  it('markiert eine fehlerhafte Library als needs-repair', async () => {
    const broken = book('b')
    delete broken.docMetaJson.source
    const { report } = await drive(fakeSource([book('a'), broken]), 'check')
    expect(report.status).toBe('needs-repair')
    expect(report.summary).toMatchObject({ scanned: 2, ok: 1, withIssues: 1 })
    expect(report.documents).toHaveLength(1)
    expect(report.summary.issuesByCode['missing-base-field']).toBe(1)
  })

  it('check-Modus repariert nichts', async () => {
    const src = fakeSource([book('a', { tags: 'x,y' })])
    const { report } = await drive(src, 'check')
    expect(src.repairCalls).toHaveLength(0)
    expect(report.status).toBe('needs-repair')
    expect(report.summary.autoFixable).toBe(1)
  })

  it('repair-Modus normalisiert und macht die Library wieder verified', async () => {
    const src = fakeSource([book('a', { tags: 'x,y' })])
    const { report } = await drive(src, 'repair')
    expect(src.repairCalls).toEqual([{ fileId: 'a', patch: { tags: ['x', 'y'] } }])
    expect(report.status).toBe('verified')
    expect(report.summary).toMatchObject({ repairedDocuments: 1, withIssues: 0 })
    expect(report.documents).toHaveLength(0)
  })

  it('repair-Modus laesst nicht-fixbare Befunde bestehen', async () => {
    const broken = book('a', { tags: 'x,y' })
    delete broken.docMetaJson.source
    const src = fakeSource([broken])
    const { report } = await drive(src, 'repair')
    expect(src.repairCalls).toHaveLength(1)
    expect(report.status).toBe('needs-repair')
    expect(report.summary.repairedDocuments).toBe(1)
    expect(report.documents[0].issues.map((i) => i.code)).toContain('missing-base-field')
  })
})
