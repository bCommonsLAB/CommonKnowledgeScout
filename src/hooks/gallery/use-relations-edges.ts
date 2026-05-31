/**
 * use-relations-edges — Quelle A des Graph-Modus (berechnete, gerichtete,
 * gewichtete „Supports"-Kanten, Zielbild §5.1/§5.4, Welle 4).
 *
 * Konsumiert `GET /api/library/[libraryId]/doc-relations`, der die
 * VORBERECHNETEN Kanten aus `doc_relations__<libraryId>` lädt (schnelles Laden
 * aus MongoDB — kein LLM zur Laufzeit) und über einen Katalog-Hash meldet, ob
 * sie veraltet sind. Knoten = die übergebenen, gefilterten Dokumente; die Form
 * ist identisch zu Quelle B/C (`toDocNode`), damit die Render-Szene
 * quellenunabhängig bleibt.
 *
 * Reine Funktion `buildRelationsEdges` (testbar) + dünner Hook
 * `useRelationsEdges`, der Fetching, Loading/Error, Staleness und die
 * Anzeige-Begrenzung kapselt.
 */

import { useEffect, useMemo, useState } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GraphData, GraphLink } from '@/components/library/gallery/graph/graph-types'
import { limitLinks, toDocNode } from './use-shared-meta-edges'

/** Eine vom Endpoint gelieferte gerichtete Beziehungs-Kante (source → target). */
export interface RelationEdge {
  source: string
  target: string
  /** Stärke der Abhängigkeit `0..1`. */
  weight: number
  rationale?: string
  relationType?: string
}

export interface RelationsEdgeParams {
  docs: DocCardMeta[]
  edges: RelationEdge[]
  minWeight?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

/**
 * Baut die `GraphData` aus den geladenen Dokumenten (Knoten) und den
 * gerichteten Kanten. Knoten = alle übergebenen Dokumente (auch isolierte).
 * Kanten werden auf vorhandene Knoten begrenzt, nach `minWeight` gefiltert und
 * über `limitLinks` (Hairball-Schutz) gedeckelt. `directed: true` → Pfeilspitze.
 */
export function buildRelationsEdges(params: RelationsEdgeParams): GraphData {
  const { docs, edges, minWeight = 0, maxEdgesPerNode, maxEdgesTotal } = params
  const nodes = docs.map(toDocNode)
  const present = new Set(nodes.map((n) => n.id))

  const links: GraphLink[] = []
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    if (!present.has(edge.source) || !present.has(edge.target)) continue
    if (edge.weight < minWeight) continue
    links.push({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      directed: true,
      rationale: edge.rationale,
    })
  }
  return { nodes, links: limitLinks(links, maxEdgesPerNode, maxEdgesTotal) }
}

export interface UseRelationsEdgesParams {
  docs: DocCardMeta[]
  libraryId?: string
  /** Nur fetchen, wenn die Quelle aktiv ist (Rules of Hooks: Hook läuft immer). */
  enabled: boolean
  minWeight?: number
  maxEdgesPerNode?: number
  maxEdgesTotal?: number
}

export interface RelationsEdgesResult {
  data: GraphData
  loading: boolean
  error: string | null
  /** `true` = Katalog hat sich seit der letzten Berechnung geändert; `null` = nie berechnet. */
  stale: boolean | null
  /** ISO-Zeitstempel der letzten Berechnung (oder `null`). */
  computedAt: string | null
}

export function useRelationsEdges(params: UseRelationsEdgesParams): RelationsEdgesResult {
  const { docs, libraryId, enabled, minWeight, maxEdgesPerNode, maxEdgesTotal } = params

  const [rawEdges, setRawEdges] = useState<RelationEdge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState<boolean | null>(null)
  const [computedAt, setComputedAt] = useState<string | null>(null)

  // Stabiler Schlüssel über die sichtbaren fileIds (sortiert): triggert Refetch,
  // wenn sich die Knotenmenge ändert (Filter/Pagination) oder nach Recompute.
  const fileIdsKey = useMemo(() => {
    const ids = docs.map((d) => d.fileId || d.id).filter((x): x is string => Boolean(x))
    return [...new Set(ids)].sort().join(',')
  }, [docs])

  useEffect(() => {
    const ids = fileIdsKey ? fileIdsKey.split(',') : []
    if (!enabled || !libraryId || ids.length === 0) {
      setRawEdges([]); setError(null); setLoading(false); setStale(null); setComputedAt(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function load(currentLibraryId: string) {
      setLoading(true)
      setError(null)
      try {
        const search = new URLSearchParams()
        search.set('fileIds', ids.join(','))
        const requestUrl = `/api/library/${encodeURIComponent(currentLibraryId)}/doc-relations?${search.toString()}`
        const res = await fetch(requestUrl, { cache: 'no-store', signal: controller.signal })
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error(`Ungültige Antwort: ${res.status}`)
        const data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Beziehungen')
        if (cancelled) return
        setRawEdges(Array.isArray(data?.edges) ? (data.edges as RelationEdge[]) : [])
        setStale(typeof data?.stale === 'boolean' ? data.stale : null)
        setComputedAt(typeof data?.computedAt === 'string' ? data.computedAt : null)
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
  }, [enabled, libraryId, fileIdsKey])

  const data = useMemo(
    () => buildRelationsEdges({ docs, edges: rawEdges, minWeight, maxEdgesPerNode, maxEdgesTotal }),
    [docs, rawEdges, minWeight, maxEdgesPerNode, maxEdgesTotal],
  )

  return { data, loading, error, stale, computedAt }
}
