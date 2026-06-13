/**
 * useGraphSimulation — kapselt das d3-force-Layout, Zoom/Pan und Knoten-Drag
 * für den Dokument-Graphen (D3 v7, portiert aus bcoop ProjectVisualizer).
 *
 * d3 mutiert `node.x/y` und ersetzt Link-Endpunkte durch Knoten-Objekte. Der
 * Hook triggert per `version` ein Re-Render pro Simulations-Tick; Drag/Zoom
 * werden imperativ über Refs gebunden, damit `doc-graph.tsx` schlank bleibt.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  select, zoom, zoomIdentity, type Simulation, type ZoomBehavior,
} from 'd3'
import type { GraphNode, GraphLink } from './graph-types'

export interface ZoomTransform { x: number; y: number; k: number }

interface UseGraphSimulationParams {
  nodes: GraphNode[]
  links: GraphLink[]
  width: number
  height: number
  /** Knotenradius (für Kollisions-Kraft). */
  radiusOf: (node: GraphNode) => number
}

export interface UseGraphSimulationResult {
  /** Re-Render-Trigger (steigt pro Tick). */
  version: number
  transform: ZoomTransform
  svgRef: React.RefObject<SVGSVGElement>
  resetZoom: () => void
  onNodePointerDown: (node: GraphNode, event: React.PointerEvent) => void
}

export function useGraphSimulation(params: UseGraphSimulationParams): UseGraphSimulationResult {
  const { nodes, links, width, height, radiusOf } = params
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [version, setVersion] = useState(0)
  const [transform, setTransform] = useState<ZoomTransform>({ x: 0, y: 0, k: 1 })

  // Simulation (neu) aufbauen, wenn sich Knoten/Kanten oder Größe ändern.
  useEffect(() => {
    if (!nodes.length) {
      simRef.current?.stop()
      return
    }
    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(90).strength(0.4))
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<GraphNode>().radius((d) => radiusOf(d) + 4).iterations(2))
      .on('tick', () => setVersion((v) => (v + 1) % 1_000_000))
    simRef.current = sim
    return () => { sim.stop() }
  }, [nodes, links, width, height, radiusOf])

  // Zoom/Pan an das <svg> binden.
  useEffect(() => {
    if (!svgRef.current) return
    const svgSel = select<SVGSVGElement, unknown>(svgRef.current)
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.02, 4])
      .on('zoom', (e) => setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k }))
    zoomRef.current = z
    svgSel.call(z)
    return () => { svgSel.on('.zoom', null) }
  }, [])

  // „Ansicht zurücksetzen" = Zoom-to-fit: alle Knoten (inkl. Radius) in den
  // sichtbaren Bereich einpassen, statt nur auf Maßstab 1 zu setzen. So bleiben
  // auch weit auseinander gedriftete Cluster vollständig sichtbar.
  const resetZoom = useCallback(() => {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z) return
    if (!nodes.length) {
      select<SVGSVGElement, unknown>(svg).call(z.transform, zoomIdentity)
      return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const r = radiusOf(n)
      const x = n.x ?? 0, y = n.y ?? 0
      if (x - r < minX) minX = x - r
      if (y - r < minY) minY = y - r
      if (x + r > maxX) maxX = x + r
      if (y + r > maxY) maxY = y + r
    }
    const w = maxX - minX, h = maxY - minY
    if (!(w > 0) || !(h > 0)) {
      select<SVGSVGElement, unknown>(svg).call(z.transform, zoomIdentity)
      return
    }
    const pad = 48
    const k = Math.max(0.02, Math.min(4, Math.min((width - pad * 2) / w, (height - pad * 2) / h)))
    const tx = width / 2 - k * (minX + maxX) / 2
    const ty = height / 2 - k * (minY + maxY) / 2
    select<SVGSVGElement, unknown>(svg).call(z.transform, zoomIdentity.translate(tx, ty).scale(k))
  }, [nodes, radiusOf, width, height])

  // Drag eines Knotens: Pointer-Koordinaten → Simulationskoordinaten.
  const onNodePointerDown = useCallback((node: GraphNode, event: React.PointerEvent) => {
    event.stopPropagation()
    const sim = simRef.current
    const svg = svgRef.current
    if (!sim || !svg) return
    const toSim = (clientX: number, clientY: number) => {
      const rect = svg.getBoundingClientRect()
      return { x: (clientX - rect.left - transform.x) / transform.k, y: (clientY - rect.top - transform.y) / transform.k }
    }
    sim.alphaTarget(0.3).restart()
    node.fx = node.x
    node.fy = node.y
    const move = (e: PointerEvent) => {
      const p = toSim(e.clientX, e.clientY)
      node.fx = p.x
      node.fy = p.y
    }
    const up = () => {
      sim.alphaTarget(0)
      node.fx = null
      node.fy = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [transform])

  return { version, transform, svgRef, resetZoom, onNodePointerDown }
}
