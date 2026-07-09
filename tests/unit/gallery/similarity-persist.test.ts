/**
 * Unit-Tests fuer die persistierten Similarity-Kanten (Stufe 4c): Ableitung der
 * ungerichteten Kanten aus den Doc-Nachbarn und die clientseitige Staleness.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveSimilarityEdgesFromDocs,
  deriveSimilarityStaleness,
} from '@/hooks/gallery/use-similarity-edges'
import type { DocCardMeta } from '@/lib/gallery/types'

function doc(fileId: string, extra: Partial<DocCardMeta> = {}): DocCardMeta {
  return { id: `${fileId}-meta`, fileId, ...extra }
}

describe('deriveSimilarityEdgesFromDocs', () => {
  it('baut ungerichtete Kanten aus den Nachbarlisten', () => {
    const docs = [
      doc('A', { similarity_neighbors: [{ fileId: 'B', weight: 0.9 }] }),
      doc('C', { similarity_neighbors: [{ fileId: 'A', weight: 0.7 }] }),
    ]
    const edges = deriveSimilarityEdgesFromDocs(docs)
    expect(edges).toHaveLength(2)
    const keys = edges.map((e) => [e.source, e.target].sort().join('|')).sort()
    expect(keys).toEqual(['A|B', 'A|C'])
  })

  it('dedupliziert dasselbe Paar (A→B und B→A) auf das staerkste Gewicht', () => {
    const docs = [
      doc('A', { similarity_neighbors: [{ fileId: 'B', weight: 0.6 }] }),
      doc('B', { similarity_neighbors: [{ fileId: 'A', weight: 0.8 }] }),
    ]
    const edges = deriveSimilarityEdgesFromDocs(docs)
    expect(edges).toHaveLength(1)
    expect(edges[0].weight).toBeCloseTo(0.8)
  })

  it('ignoriert Selbstkanten und Docs ohne Nachbarn', () => {
    const docs = [
      doc('A', { similarity_neighbors: [{ fileId: 'A', weight: 1 }] }),
      doc('B'),
    ]
    expect(deriveSimilarityEdgesFromDocs(docs)).toEqual([])
  })
})

describe('deriveSimilarityStaleness', () => {
  it('null, wenn kein Doc einen Stand hat (nie berechnet)', () => {
    expect(deriveSimilarityStaleness([doc('A'), doc('B')])).toEqual({ stale: null, computedAt: null })
  })

  it('nicht veraltet, wenn alle Docs vor dem Stand geaendert wurden', () => {
    const docs = [
      doc('A', { similarity_stand: '2026-07-09T10:00:00.000Z', upsertedAt: '2026-07-01T00:00:00.000Z' }),
      doc('B', { similarity_stand: '2026-07-09T09:00:00.000Z', upsertedAt: '2026-07-02T00:00:00.000Z' }),
    ]
    expect(deriveSimilarityStaleness(docs)).toEqual({
      stale: false,
      computedAt: '2026-07-09T10:00:00.000Z',
    })
  })

  it('veraltet, wenn ein Doc nach dem Stand geaendert wurde', () => {
    const docs = [
      doc('A', { similarity_stand: '2026-07-01T00:00:00.000Z', upsertedAt: '2026-07-09T00:00:00.000Z' }),
    ]
    expect(deriveSimilarityStaleness(docs).stale).toBe(true)
  })

  it('veraltet, wenn ein neuer Doc noch keinen Stand hat', () => {
    const docs = [
      doc('A', { similarity_stand: '2026-07-09T00:00:00.000Z' }),
      doc('B'), // Neuzugang ohne Berechnung
    ]
    const res = deriveSimilarityStaleness(docs)
    expect(res.stale).toBe(true)
    expect(res.computedAt).toBe('2026-07-09T00:00:00.000Z')
  })
})
