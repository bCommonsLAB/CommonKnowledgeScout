/**
 * use-similarity-edges — Quelle C des Graph-Modus ("semantische Nachbarn",
 * Zielbild §5.3, Welle 3).
 *
 * Konsumiert den Endpoint `GET /api/chat/[libraryId]/doc-neighbors`, der aus den
 * vorhandenen Dokument-Embeddings Top-K-Nachbar-Kanten zwischen den sichtbaren
 * (bereits gefilterten) Dokumenten berechnet. KEIN LLM, KEIN Speicher — die
 * Kanten werden zur Laufzeit abgeleitet.
 *
 * Reine Funktion `buildSimilarityEdges` (testbar) + dünner Hook
 * `useSimilarityEdges`, der das Fetching, Loading/Error und die
 * Anzeige-Begrenzung kapselt. Die Knoten-Form ist identisch zu Quelle B
 * (`toDocNode`), damit die Render-Szene quellenunabhängig bleibt.
 */

import { useEffect, useMemo, useState } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GraphData, GraphLink } from '@/components/library/gallery/graph/graph-types'
import { limitLinks, toDocNode } from './use-shared-meta-edges'

/** Eine vom Endpoint gelieferte ungerichtete Ähnlichkeits-Kante (fileId↔fileId). */
export interface SimilarityNeighborEdge {
  source: string
  target: string
  /** Ähnlichkeits-Score (Vector-Search-Score). */
  weight: number
}

export interface SimilarityEdgeParams {
  docs: DocCardMeta[]
  edges: SimilarityNeighborEdge[]
  /** Mindest-Gewicht, ab dem eine Kante gezeigt wird. */
  minWeight?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

/**
 * Baut die `GraphData` aus den geladenen Dokumenten (Knoten) und den vom Server
 * gelieferten Ähnlichkeits-Kanten. Knoten = alle übergebenen Dokumente (auch
 * isolierte). Kanten werden auf vorhandene Knoten begrenzt, nach `minWeight`
 * gefiltert und über `limitLinks` (Hairball-Schutz) gedeckelt.
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

export interface UseSimilarityEdgesParams {
  docs: DocCardMeta[]
  libraryId?: string
  /** Nur fetchen, wenn die Quelle aktiv ist (Rules of Hooks: Hook läuft immer). */
  enabled: boolean
  /** Nachbarn pro Knoten (aus `edgeSources.similarity.topK`). */
  topK: number
  minWeight?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

export interface SimilarityEdgesResult {
  data: GraphData
  loading: boolean
  error: string | null
}

export function useSimilarityEdges(params: UseSimilarityEdgesParams): SimilarityEdgesResult {
  const { docs, libraryId, enabled, topK, minWeight, maxEdgesPerNode, maxEdgesTotal } = params

  const [rawEdges, setRawEdges] = useState<SimilarityNeighborEdge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stabiler Schlüssel über die sichtbaren fileIds (sortiert) — triggert genau
  // dann ein Refetch, wenn sich die Knotenmenge ändert (z. B. Filter/Pagination).
  const fileIdsKey = useMemo(() => {
    const ids = docs.map((d) => d.fileId || d.id).filter((x): x is string => Boolean(x))
    return [...new Set(ids)].sort().join(',')
  }, [docs])

  useEffect(() => {
    const ids = fileIdsKey ? fileIdsKey.split(',') : []
    if (!enabled || !libraryId || ids.length === 0) {
      setRawEdges([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function load(currentLibraryId: string) {
      setLoading(true)
      setError(null)
      try {
        // POST statt GET: bei vielen Knoten (Hunderte) sprengt eine fileIds-Query
        // die Header-Grenze des Servers (HTTP 431). fileIds gehen daher in den Body.
        //
        // Chunking: der Server verarbeitet max. 200 Seeds pro Request (MAX_NODES,
        // sonst wurden Bibliotheken >200 Docs still auf die ersten 200 gekappt).
        // Wir fragen deshalb SEQUENZIELL in 200er-Portionen an — sequenziell,
        // damit nicht mehrere schwere Vector-Aggregationen gleichzeitig den
        // Mongo-Connection-Pool belegen (Befund 2026-07-08). `neighborScope`
        // erlaubt Kanten zwischen den Chunks (kompletter sichtbarer Bestand).
        const CHUNK_SIZE = 200
        const requestUrl = `/api/chat/${encodeURIComponent(currentLibraryId)}/doc-neighbors`
        const pairWeight = new Map<string, number>()
        for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
          const chunk = ids.slice(offset, offset + CHUNK_SIZE)
          const res = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileIds: chunk,
              topK,
              ...(ids.length > CHUNK_SIZE ? { neighborScope: ids } : {}),
            }),
            cache: 'no-store',
            signal: controller.signal,
          })
          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('application/json')) throw new Error(`Ungültige Antwort: ${res.status}`)
          const data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Nachbarn')
          if (cancelled) return
          const chunkEdges = Array.isArray(data?.edges) ? (data.edges as SimilarityNeighborEdge[]) : []
          // Über Chunk-Grenzen kann dasselbe Paar doppelt auftauchen —
          // ungerichtet deduplizieren, stärkstes Gewicht behalten.
          for (const edge of chunkEdges) {
            const [a, b] = edge.source < edge.target ? [edge.source, edge.target] : [edge.target, edge.source]
            const key = `${a}|${b}`
            const prev = pairWeight.get(key)
            if (prev === undefined || edge.weight > prev) pairWeight.set(key, edge.weight)
          }
        }
        if (!cancelled) {
          setRawEdges(
            [...pairWeight.entries()].map(([key, weight]) => {
              const [source, target] = key.split('|')
              return { source, target, weight }
            }),
          )
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
        setRawEdges([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load(libraryId)
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, libraryId, topK, fileIdsKey])

  const data = useMemo(
    () => buildSimilarityEdges({ docs, edges: rawEdges, minWeight, maxEdgesPerNode, maxEdgesTotal }),
    [docs, rawEdges, minWeight, maxEdgesPerNode, maxEdgesTotal],
  )

  return { data, loading, error }
}
