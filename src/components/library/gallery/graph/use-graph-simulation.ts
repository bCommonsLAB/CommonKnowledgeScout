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
      .force('collide', forceCollide<GraphNode>().radius((d) => radiusOf(d) + 4))
      .on('tick', () => setVersion((v) => (v + 1) % 1_000_000))
    simRef.current = sim
    return () => { sim.stop() }
  }, [nodes, links, width, height, radiusOf])

  // Zoom/Pan an das <svg> binden.
  useEffect(() => {
    if (!svgRef.current) return
    const svgSel = select<SVGSVGElement, unknown>(svgRef.current)
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (e) => setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k }))
    zoomRef.current = z
    svgSel.call(z)
    return () => { svgSel.on('.zoom', null) }
  }, [])

  const resetZoom = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      select<SVGSVGElement, unknown>(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
    }
  }, [])

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
