import { describe, it, expect } from 'vitest'
import { buildSimilarityEdges } from '@/hooks/gallery/use-similarity-edges'
import type { DocCardMeta } from '@/lib/gallery/types'
import { endpointId } from '@/components/library/gallery/graph/graph-types'

function doc(id: string, fields: Partial<DocCardMeta> = {}): DocCardMeta {
  return { id, fileId: id, title: id, ...fields }
}

describe('buildSimilarityEdges — Quelle C (Embedding-Ähnlichkeit)', () => {
  it('erzeugt einen Knoten je Dokument (auch isolierte)', () => {
    const docs = [doc('a'), doc('b'), doc('c')]
    const { nodes, links } = buildSimilarityEdges({ docs, edges: [] })
    expect(nodes).toHaveLength(3)
    expect(links).toHaveLength(0)
  })

  it('mappt Server-Kanten zwischen vorhandenen Knoten', () => {
    const docs = [doc('a'), doc('b')]
    const { links } = buildSimilarityEdges({ docs, edges: [{ source: 'a', target: 'b', weight: 0.9 }] })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(0.9)
    expect([endpointId(links[0].source), endpointId(links[0].target)].sort()).toEqual(['a', 'b'])
  })

  it('verwirft Kanten zu nicht geladenen Knoten (Konsistenz mit Knotenmenge)', () => {
    const docs = [doc('a')]
    const { links } = buildSimilarityEdges({ docs, edges: [{ source: 'a', target: 'z', weight: 0.5 }] })
    expect(links).toHaveLength(0)
  })

  it('verwirft Selbstkanten (Self-Exclusion)', () => {
    const docs = [doc('a')]
    const { links } = buildSimilarityEdges({ docs, edges: [{ source: 'a', target: 'a', weight: 1 }] })
    expect(links).toHaveLength(0)
  })

  it('minWeight filtert schwache Kanten weg', () => {
    const docs = [doc('a'), doc('b'), doc('c')]
    const edges = [
      { source: 'a', target: 'b', weight: 0.8 },
      { source: 'a', target: 'c', weight: 0.3 },
    ]
    const { links } = buildSimilarityEdges({ docs, edges, minWeight: 0.5 })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(0.8)
  })

  it('maxEdgesTotal behält die stärksten Kanten', () => {
    const docs = [doc('a'), doc('b'), doc('c')]
    const edges = [
      { source: 'a', target: 'b', weight: 0.9 },
      { source: 'a', target: 'c', weight: 0.4 },
    ]
    const { links } = buildSimilarityEdges({ docs, edges, maxEdgesTotal: 1 })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(0.9)
  })
})
