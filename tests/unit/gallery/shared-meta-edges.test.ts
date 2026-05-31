import { describe, it, expect } from 'vitest'
import { buildSharedMetaEdges } from '@/hooks/gallery/use-shared-meta-edges'
import type { DocCardMeta } from '@/lib/gallery/types'
import { endpointId } from '@/components/library/gallery/graph/graph-types'

function doc(id: string, fields: Partial<DocCardMeta>): DocCardMeta {
  return { id, fileId: id, title: id, ...fields }
}

describe('buildSharedMetaEdges — Quelle B (gemeinsame Metadaten)', () => {
  it('projection: verbindet Dokumente mit gemeinsamem String-Feld', () => {
    const docs = [doc('a', { category: 'Energie' }), doc('b', { category: 'Energie' }), doc('c', { category: 'Mobilität' })]
    const { nodes, links } = buildSharedMetaEdges({ docs, field: 'category', mode: 'projection' })
    expect(nodes).toHaveLength(3)
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(1)
    const ids = [endpointId(links[0].source), endpointId(links[0].target)].sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('projection: Gewicht = Anzahl geteilter Werte (Array-Feld)', () => {
    const docs = [doc('a', { tags: ['x', 'y', 'z'] }), doc('b', { tags: ['x', 'y'] })]
    const { links } = buildSharedMetaEdges({ docs, field: 'tags', mode: 'projection' })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(2)
  })

  it('projection: minShared filtert schwache Kanten weg', () => {
    const docs = [doc('a', { tags: ['x', 'y'] }), doc('b', { tags: ['x'] })]
    expect(buildSharedMetaEdges({ docs, field: 'tags', mode: 'projection', minShared: 2 }).links).toHaveLength(0)
    expect(buildSharedMetaEdges({ docs, field: 'tags', mode: 'projection', minShared: 1 }).links).toHaveLength(1)
  })

  it('hub: erzeugt Hub-Knoten mit Dokumentzähler + bipartite Kanten', () => {
    const docs = [doc('a', { category: 'Energie' }), doc('b', { category: 'Energie' })]
    const { nodes, links } = buildSharedMetaEdges({ docs, field: 'category', mode: 'hub' })
    const hubs = nodes.filter((n) => n.kind === 'hub')
    expect(hubs).toHaveLength(1)
    expect(hubs[0].hubCount).toBe(2)
    expect(hubs[0].id).toBe('hub:category:Energie')
    expect(links).toHaveLength(2)
  })

  it('leeres/fehlendes Feld erzeugt keine Kanten', () => {
    const docs = [doc('a', {}), doc('b', {})]
    expect(buildSharedMetaEdges({ docs, field: 'category', mode: 'projection' }).links).toHaveLength(0)
  })

  it('maxEdgesTotal begrenzt auf die stärksten Kanten', () => {
    const docs = [
      doc('a', { tags: ['x', 'y'] }),
      doc('b', { tags: ['x', 'y'] }), // a-b: Gewicht 2
      doc('c', { tags: ['x'] }),      // schwächere Kanten Gewicht 1
    ]
    const { links } = buildSharedMetaEdges({ docs, field: 'tags', mode: 'projection', maxEdgesTotal: 1 })
    expect(links).toHaveLength(1)
    expect(links[0].weight).toBe(2)
  })

  it('maxEdgesPerNode begrenzt den Knotengrad', () => {
    const docs = [
      doc('a', { category: 'E' }), doc('b', { category: 'E' }),
      doc('c', { category: 'E' }), doc('d', { category: 'E' }),
    ]
    const { links } = buildSharedMetaEdges({ docs, field: 'category', mode: 'projection', maxEdgesPerNode: 1 })
    // Bei Grad-Limit 1 darf kein Knoten in mehr als einer Kante vorkommen.
    const degree = new Map<string, number>()
    for (const l of links) {
      for (const id of [endpointId(l.source), endpointId(l.target)]) degree.set(id, (degree.get(id) ?? 0) + 1)
    }
    expect(Math.max(...degree.values())).toBeLessThanOrEqual(1)
  })
})
