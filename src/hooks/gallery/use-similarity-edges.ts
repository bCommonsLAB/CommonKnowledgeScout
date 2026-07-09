/**
 * use-similarity-edges — Quelle C des Graph-Modus ("semantische Nachbarn",
 * Zielbild §5.3).
 *
 * Stufe 4c (Plan summen-und-synergie-aggregation, Todo similarity-persist):
 * Die Kanten kommen jetzt aus den PERSISTIERTEN Top-K-Nachbarn der geladenen
 * Dokumente (`doc.similarity_neighbors`) — KEINE Live-Vector-Suche mehr beim
 * Graph-Oeffnen (das feuerte bis zu 606 einzelne `$vectorSearch`-Ops gegen den
 * RAM-gebundenen M10, Befund 2026-07-09). Neu berechnet werden die Nachbarn nur
 * per Button (`POST doc-similarity/recompute` → external-job). Staleness wird
 * clientseitig aus den geladenen Docs abgeleitet (kein Extra-Request).
 *
 * Reine Funktionen (`buildSimilarityEdges`, `deriveSimilarityEdgesFromDocs`,
 * `deriveSimilarityStaleness`) sind testbar; der Hook ist ein duenner Wrapper.
 */

import { useMemo } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GraphData, GraphLink } from '@/components/library/gallery/graph/graph-types'
import { limitLinks, toDocNode } from './use-shared-meta-edges'

/** Eine ungerichtete Ähnlichkeits-Kante (fileId↔fileId) mit Vector-Score. */
export interface SimilarityNeighborEdge {
  source: string
  target: string
  weight: number
}

export interface SimilarityEdgeParams {
  docs: DocCardMeta[]
  edges: SimilarityNeighborEdge[]
  minWeight?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

/**
 * Baut die `GraphData` aus den Dokumenten (Knoten) und den Ähnlichkeits-Kanten.
 * Kanten werden auf vorhandene Knoten begrenzt, nach `minWeight` gefiltert und
 * über `limitLinks` (Hairball-Schutz) gedeckelt.
 */
export function buildSimilarityEdges(params: SimilarityEdgeParams): GraphData {
  const { docs, edges, minWeight = 0, maxEdgesPerNode, maxEdgesTotal } = params
  const nodes = docs.map(toDocNode)
  const present = new Set(nodes.map((n) => n.id))

  const links: GraphLink[] = []
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    if (!present.has(edge.source) || !present.has(edge.target)) continue
    if (edge.weight < minWeight) continue
    links.push({ source: edge.source, target: edge.target, weight: edge.weight })
  }
  return { nodes, links: limitLinks(links, maxEdgesPerNode, maxEdgesTotal) }
}

/**
 * Leitet die ungerichteten, deduplizierten Ähnlichkeits-Kanten aus den
 * persistierten Top-K-Nachbarn der Docs ab (staerkstes Gewicht je Paar).
 * Ein Doc listet seine Nachbarn gerichtet; die Union ergibt die ungerichteten
 * Kanten. Nachbarn ausserhalb der geladenen Menge bleiben (werden erst in
 * `buildSimilarityEdges` gegen die Knotenmenge gefiltert).
 */
export function deriveSimilarityEdgesFromDocs(docs: DocCardMeta[]): SimilarityNeighborEdge[] {
  const pairWeight = new Map<string, number>()
  for (const doc of docs) {
    const seed = doc.fileId || doc.id
    if (!seed || !Array.isArray(doc.similarity_neighbors)) continue
    for (const n of doc.similarity_neighbors) {
      if (!n?.fileId || n.fileId === seed) continue
      const [a, b] = seed < n.fileId ? [seed, n.fileId] : [n.fileId, seed]
      const key = `${a}|${b}`
      const prev = pairWeight.get(key)
      if (prev === undefined || n.weight > prev) pairWeight.set(key, n.weight)
    }
  }
  return [...pairWeight.entries()].map(([key, weight]) => {
    const [source, target] = key.split('|')
    return { source, target, weight }
  })
}

/**
 * Staleness aus den geladenen Docs: `null` = noch nie berechnet (kein Doc hat
 * einen Stand). `stale=true`, wenn ein Doc keinen Nachbar-Stand hat (neu) ODER
 * seit der Berechnung geaendert wurde (`upsertedAt` > `similarity_stand`).
 * `computedAt` = juengster Stand.
 */
export function deriveSimilarityStaleness(docs: DocCardMeta[]): {
  stale: boolean | null
  computedAt: string | null
} {
  let anyStand = false
  let newest: string | null = null
  let stale = false
  for (const doc of docs) {
    const stand = doc.similarity_stand
    if (!stand) {
      stale = true // Doc noch nie berechnet (z.B. nach Neuzugang)
      continue
    }
    anyStand = true
    if (newest === null || stand > newest) newest = stand
    // Doc nach der Berechnung geaendert? ISO-Strings sind lexikografisch vergleichbar.
    if (doc.upsertedAt && doc.upsertedAt > stand) stale = true
  }
  if (!anyStand) return { stale: null, computedAt: null }
  return { stale, computedAt: newest }
}

export interface UseSimilarityEdgesParams {
  docs: DocCardMeta[]
  libraryId?: string
  enabled: boolean
  /** Beibehalten fuer API-Kompatibilitaet; die persistierten Nachbarn tragen ihr eigenes K. */
  topK?: number
  minWeight?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

export interface SimilarityEdgesResult {
  data: GraphData
  /** Ungefilterte Kanten (Datenbasis der Synergie-Summe im Graph-Panel). */
  rawEdges: SimilarityNeighborEdge[]
  loading: boolean
  error: string | null
  /** `true` = Katalog hat sich seit der Berechnung geaendert; `null` = nie berechnet. */
  stale: boolean | null
  computedAt: string | null
}

export function useSimilarityEdges(params: UseSimilarityEdgesParams): SimilarityEdgesResult {
  const { docs, enabled, minWeight, maxEdgesPerNode, maxEdgesTotal } = params

  const rawEdges = useMemo(
    () => (enabled ? deriveSimilarityEdgesFromDocs(docs) : []),
    [enabled, docs],
  )
  const { stale, computedAt } = useMemo(
    () => (enabled ? deriveSimilarityStaleness(docs) : { stale: null, computedAt: null }),
    [enabled, docs],
  )
  const data = useMemo(
    () => buildSimilarityEdges({ docs, edges: rawEdges, minWeight, maxEdgesPerNode, maxEdgesTotal }),
    [docs, rawEdges, minWeight, maxEdgesPerNode, maxEdgesTotal],
  )

  // Kein Fetch mehr → kein Lade-/Fehlerzustand.
  return { data, rawEdges, loading: false, error: null, stale, computedAt }
}
