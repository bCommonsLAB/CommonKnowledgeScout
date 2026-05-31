/**
 * use-shared-meta-edges — Quelle B des Graph-Modus (Obsidian-Stil, Welle 2).
 *
 * Baut Kanten client-seitig aus gemeinsamen Metadaten-Werten der geladenen
 * `DocCardMeta` — KEIN LLM, KEIN Speicher, sofort live (Zielbild §5.2). Zwei
 * Spielarten:
 *  - `projection`: Dokument↔Dokument, Kante wenn ≥ `minShared` Werte geteilt.
 *  - `hub`: Metadaten-Werte werden zu eigenen Hub-Knoten (bipartit).
 *
 * Reine Funktion `buildSharedMetaEdges` (testbar) + dünner `useSharedMetaEdges`.
 */

import { useMemo } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GraphData, GraphNode, GraphLink } from '@/components/library/gallery/graph/graph-types'

export interface SharedMetaParams {
  docs: DocCardMeta[]
  /** Meta-Feld, über das verbunden wird (string oder string[] im Doc). */
  field: string
  mode: 'hub' | 'projection'
  /** Projektion: Mindestanzahl geteilter Werte (Default 1). */
  minShared?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

/** Extrahiert die (String-)Werte eines Felds aus einem Dokument. */
function valuesOf(doc: DocCardMeta, field: string): string[] {
  const raw = (doc as unknown as Record<string, unknown>)[field]
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (typeof raw === 'string' && raw.length > 0) return [raw]
  return []
}

export function docId(doc: DocCardMeta): string {
  return doc.fileId || doc.id
}

/**
 * Baut einen Dokument-Knoten aus `DocCardMeta`. Exportiert, damit andere
 * Kantenquellen (z. B. Quelle C — Ähnlichkeit) dieselbe Knoten-Form nutzen.
 */
export function toDocNode(doc: DocCardMeta): GraphNode {
  return { id: docId(doc), kind: 'doc', label: doc.title || doc.shortTitle || doc.slug || docId(doc), doc }
}

/** Begrenzt Kanten global (Top-N nach Gewicht) und pro Knoten (Hairball-Schutz). */
export function limitLinks(links: GraphLink[], maxPerNode?: number, maxTotal?: number): GraphLink[] {
  const sorted = [...links].sort((a, b) => b.weight - a.weight)
  const perNode = new Map<string, number>()
  const out: GraphLink[] = []
  for (const link of sorted) {
    if (maxTotal !== undefined && out.length >= maxTotal) break
    const s = typeof link.source === 'string' ? link.source : link.source.id
    const t = typeof link.target === 'string' ? link.target : link.target.id
    if (maxPerNode !== undefined && ((perNode.get(s) ?? 0) >= maxPerNode || (perNode.get(t) ?? 0) >= maxPerNode)) continue
    out.push(link)
    perNode.set(s, (perNode.get(s) ?? 0) + 1)
    perNode.set(t, (perNode.get(t) ?? 0) + 1)
  }
  return out
}

export function buildSharedMetaEdges(params: SharedMetaParams): GraphData {
  const { docs, field, mode, minShared = 1, maxEdgesPerNode, maxEdgesTotal } = params
  const docNodes = docs.map(toDocNode)

  if (mode === 'hub') {
    const hubNodes = new Map<string, GraphNode>()
    const links: GraphLink[] = []
    for (const doc of docs) {
      for (const value of valuesOf(doc, field)) {
        const hubId = `hub:${field}:${value}`
        const existing = hubNodes.get(hubId)
        if (existing) existing.hubCount = (existing.hubCount ?? 0) + 1
        else hubNodes.set(hubId, { id: hubId, kind: 'hub', label: value, hubField: field, hubValue: value, hubCount: 1 })
        links.push({ source: docId(doc), target: hubId, weight: 1 })
      }
    }
    return { nodes: [...docNodes, ...hubNodes.values()], links: limitLinks(links, maxEdgesPerNode, maxEdgesTotal) }
  }

  // projection: über einen Wert→Dokumente-Index Paargewichte aufsummieren.
  const valueToDocs = new Map<string, string[]>()
  for (const doc of docs) {
    const id = docId(doc)
    for (const value of valuesOf(doc, field)) {
      const list = valueToDocs.get(value)
      if (list) list.push(id)
      else valueToDocs.set(value, [id])
    }
  }
  const pairWeight = new Map<string, number>()
  for (const ids of valueToDocs.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`
        pairWeight.set(key, (pairWeight.get(key) ?? 0) + 1)
      }
    }
  }
  const links: GraphLink[] = []
  for (const [key, weight] of pairWeight) {
    if (weight < minShared) continue
    const [source, target] = key.split('|')
    links.push({ source, target, weight })
  }
  return { nodes: docNodes, links: limitLinks(links, maxEdgesPerNode, maxEdgesTotal) }
}

export function useSharedMetaEdges(params: SharedMetaParams): GraphData {
  const { docs, field, mode, minShared, maxEdgesPerNode, maxEdgesTotal } = params
  return useMemo(
    () => buildSharedMetaEdges({ docs, field, mode, minShared, maxEdgesPerNode, maxEdgesTotal }),
    [docs, field, mode, minShared, maxEdgesPerNode, maxEdgesTotal],
  )
}
