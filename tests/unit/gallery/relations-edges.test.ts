import { describe, it, expect } from 'vitest'
import { buildRelationsEdges } from '@/hooks/gallery/use-relations-edges'
import type { DocCardMeta } from '@/lib/gallery/types'
import { endpointId } from '@/components/library/gallery/graph/graph-types'

function doc(id: string, fields: Partial<DocCardMeta> = {}): DocCardMeta {
  return { id, fileId: id, title: id, ...fields }
}

describe('buildRelationsEdges — Quelle A (berechnete Beziehungen)', () => {
  it('erzeugt einen Knoten je Dokument (auch isolierte)', () => {
    const docs = [doc('a'), doc('b'), doc('c')]
    const { nodes, links } = buildRelationsEdges({ docs, edges: [] })
    expect(nodes).toHaveLength(3)
    expect(links).toHaveLength(0)
  })

  it('markiert Kanten als gerichtet (directed) und behält die Richtung', () => {
    const docs = [doc('a'), doc('b')]
    const { links } = buildRelationsEdges({ docs, edges: [{ source: 'a', target: 'b', weight: 0.7 }] })
    expect(links).toHaveLength(1)
    expect(links[0].directed).toBe(true)
    expect(endpointId(links[0].source)).toBe('a')
    expect(endpointId(links[0].target)).toBe('b')
  })

  it('übernimmt die rationale der Kante', () => {
    const docs = [doc('a'), doc('b')]
    const { links } = buildRelationsEdges({
      docs, edges: [{ source: 'a', target: 'b', weight: 0.5, rationale: 'A ermöglicht B' }],
    })
    expect(links[0].rationale).toBe('A ermöglicht B')
  })

  it('verwirft Kanten zu nicht geladenen Knoten (Konsistenz)', () => {
    const docs = [doc('a')]
    const { links } = buildRelationsEdges({ docs, edges: [{ source: 'a', target: 'z', weight: 0.5 }] })
    expect(links).toHaveLength(0)
  })

  it('verwirft Selbstkanten', () => {
    const docs = [doc('a')]
    const { links } = buildRelationsEdges({ docs, edges: [{ source: 'a', target: 'a', weight: 1 }] })
    expect(links).toHaveLength(0)
  })

  it('minWeight filtert schwache Kanten weg', () => {
    const docs = [doc('a'), doc('b'), doc('c')]
    const edges = [
      { source: 'a', target: 'b', weight: 0.8 },
      { source: 'a', target: 'c', weight: 0.3 },
    ]
    const { links } = buildRelationsEdges({ docs, edges, minWeight: 0.5 })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(0.8)
  })

  it('maxEdgesTotal behält die stärksten Kanten', () => {
    const docs = [doc('a'), doc('b'), doc('c')]
    const edges = [
      { source: 'a', target: 'b', weight: 0.9 },
      { source: 'a', target: 'c', weight: 0.4 },
    ]
    const { links } = buildRelationsEdges({ docs, edges, maxEdgesTotal: 1 })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(0.9)
  })
})
