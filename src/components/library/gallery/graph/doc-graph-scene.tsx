'use client'

/**
 * DocGraphScene — das eigentliche SVG-Rendering des Graphen.
 *
 * Bindet die d3-Simulation (Layout + Zoom + Drag), zeichnet Kanten und Knoten
 * (config-getriebene Encodings) und behandelt Hover (Tooltip) sowie Klick
 * (Detailansicht öffnen + Nachbarschafts-Highlight). Hub-Knoten (Tag-Hubs)
 * bekommen ein eigenes Styling.
 */

import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GraphData, GraphNode } from './graph-types'
import { endpointId } from './graph-types'
import { useGraphSimulation } from './use-graph-simulation'
import { DocGraphTooltip } from './doc-graph-tooltip'
import { nodeColor, nodeOpacity, nodeRadius, hubRadius, maxOf, readNumber } from './graph-encodings'

interface Encodings { sizeField?: string; colorField?: string; opacityField?: string; colorMap?: Record<string, string> }

interface DocGraphSceneProps {
  data: GraphData
  docs: DocCardMeta[]
  encodings: Encodings
  width: number
  height: number
  onOpenDocument: (doc: DocCardMeta) => void
  /**
   * „Supporter darstellen" (nur Beziehungen/Quelle A): zeichnet um jeden Knoten
   * einen strichlierten hellorangen Halo, dessen Größe die akkumulierte Wirkung
   * (sizeField) der von ihm unterstützten Ziel-Maßnahmen zeigt. Macht kleine
   * Unterstützungs-Maßnahmen mit großer indirekter Wirkung sichtbar.
   */
  showSupporters?: boolean
}

export function DocGraphScene({ data, docs, encodings, width, height, onOpenDocument, showSupporters }: DocGraphSceneProps) {
  const { sizeField, colorField, opacityField, colorMap } = encodings
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const domainMax = useMemo(() => maxOf(docs, sizeField), [docs, sizeField])
  const radiusOf = useCallback(
    (n: GraphNode) => (n.kind === 'hub' ? hubRadius(n.hubCount ?? 1) : nodeRadius(n.doc as DocCardMeta, sizeField, domainMax)),
    [sizeField, domainMax],
  )

  // Supporter-Score je Knoten: Summe der Wirkung (sizeField) der unterstützten
  // Ziele, gewichtet mit dem Kantengewicht. Nur über gerichtete Kanten (Quelle A).
  const supporterScore = useMemo(() => {
    const m = new Map<string, number>()
    if (!showSupporters) return m
    for (const l of data.links) {
      if (!l.directed) continue
      const s = l.source as GraphNode, t = l.target as GraphNode
      if (typeof s !== 'object' || typeof t !== 'object') continue
      const impact = t.kind === 'hub' ? 0 : (readNumber(t.doc as DocCardMeta, sizeField) ?? 0)
      if (impact <= 0) continue
      const w = typeof l.weight === 'number' ? l.weight : 1
      m.set(s.id, (m.get(s.id) ?? 0) + impact * w)
    }
    return m
  }, [showSupporters, data.links, sizeField])
  const maxSupporter = useMemo(
    () => (supporterScore.size ? Math.max(...supporterScore.values()) : 0),
    [supporterScore],
  )
  // Halo-Radius: Basis-Radius + sqrt-skalierter Zuschlag (Fläche ~ Score).
  const haloRadiusOf = useCallback(
    (n: GraphNode): number | null => {
      const score = supporterScore.get(n.id) ?? 0
      if (score <= 0 || maxSupporter <= 0) return null
      return radiusOf(n) + 6 + Math.sqrt(score / maxSupporter) * 30
    },
    [supporterScore, maxSupporter, radiusOf],
  )

  const { version, transform, svgRef, resetZoom, onNodePointerDown } = useGraphSimulation({
    nodes: data.nodes, links: data.links, width, height, radiusOf,
  })

  // Nachbarschaft des ausgewählten Knotens (für Highlight/Abblenden).
  const neighbors = useMemo(() => {
    if (!selectedId) return null
    const set = new Set<string>([selectedId])
    for (const l of data.links) {
      const s = endpointId(l.source), t = endpointId(l.target)
      if (s === selectedId) set.add(t)
      else if (t === selectedId) set.add(s)
    }
    return set
  }, [selectedId, data.links])

  // version wird gelesen, damit das Re-Render pro Tick die mutierten x/y zeigt.
  void version
  const dim = (id: string) => (neighbors && !neighbors.has(id) ? 0.15 : 1)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Button
        type="button" variant="outline" size="sm"
        className="absolute right-3 top-3 z-20 h-7"
        onClick={resetZoom}
      >
        {t('gallery.graph.resetZoom')}
      </Button>
      <svg ref={svgRef} width={width} height={height} className="touch-none select-none" onClick={() => setSelectedId(null)}>
        <defs>
          {/* Pfeilspitze für gerichtete Kanten (Quelle A, Welle 4). */}
          <marker
            id="doc-graph-arrow" viewBox="0 0 10 10" refX={9} refY={5}
            markerWidth={6} markerHeight={6} orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {data.links.map((l, i) => {
            const s = l.source as GraphNode, t = l.target as GraphNode
            if (typeof s !== 'object' || typeof t !== 'object') return null
            const visible = !neighbors || (neighbors.has(s.id) && neighbors.has(t.id))
            // Gerichtete Kanten: Endpunkt um den Ziel-Radius zurückziehen, damit
            // die Pfeilspitze nicht unter dem Knoten verschwindet.
            let x2 = t.x ?? 0, y2 = t.y ?? 0
            if (l.directed) {
              const dx = (t.x ?? 0) - (s.x ?? 0), dy = (t.y ?? 0) - (s.y ?? 0)
              const len = Math.hypot(dx, dy) || 1
              const off = radiusOf(t) + 3
              x2 = (t.x ?? 0) - (dx / len) * off
              y2 = (t.y ?? 0) - (dy / len) * off
            }
            return (
              <line
                key={i} x1={s.x} y1={s.y} x2={x2} y2={y2}
                stroke="currentColor" className="text-muted-foreground"
                strokeOpacity={visible ? 0.35 : 0.05}
                strokeWidth={Math.min(5, 0.6 + l.weight)}
                markerEnd={l.directed && visible ? 'url(#doc-graph-arrow)' : undefined}
              />
            )
          })}
          {data.nodes.map((n) => {
            const r = radiusOf(n)
            const isHub = n.kind === 'hub'
            const fill = isHub ? '#94a3b8' : nodeColor(n.doc as DocCardMeta, colorField, colorMap)
            const opacity = (isHub ? 0.9 : nodeOpacity(n.doc as DocCardMeta, opacityField)) * dim(n.id)
            return (
              <g
                key={n.id}
                transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                className="cursor-pointer"
                onPointerDown={(e) => onNodePointerDown(n, e)}
                onMouseEnter={() => !isHub && setHovered(n)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(n.id)
                  if (!isHub && n.doc) onOpenDocument(n.doc)
                }}
              >
                {(() => {
                  // Supporter-Halo (strichliert, hell orange): akkumulierte
                  // Wirkung der unterstützten Ziele. Hinter dem Knoten gezeichnet.
                  const halo = !isHub ? haloRadiusOf(n) : null
                  return halo ? (
                    <circle
                      r={halo} fill="#fdba74" fillOpacity={0.12 * dim(n.id)}
                      stroke="#fb923c" strokeOpacity={0.85 * dim(n.id)}
                      strokeWidth={1.5} strokeDasharray="4 3"
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : null
                })()}
                {isHub ? (
                  // Gruppen-/Hub-Knoten (z. B. Arbeitsgruppe, Kategorie): als
                  // abgerundetes Quadrat, damit Cluster-Zentren klar von den
                  // runden Maßnahmen-Knoten unterscheidbar sind.
                  <rect
                    x={-r} y={-r} width={r * 2} height={r * 2} rx={3}
                    fill={fill} fillOpacity={opacity}
                    stroke="#475569" strokeWidth={1.5} strokeDasharray="3 2"
                  />
                ) : (
                  <circle r={r} fill={fill} fillOpacity={opacity} stroke="#ffffff" strokeWidth={1} />
                )}
                {(isHub || r > 16) && (
                  <text x={r + 3} y={4} fontSize={11} className="fill-foreground" style={{ pointerEvents: 'none' }}>
                    {n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      {hovered?.doc && (
        <DocGraphTooltip
          doc={hovered.doc}
          x={(hovered.x ?? 0) * transform.k + transform.x}
          y={(hovered.y ?? 0) * transform.k + transform.y}
          fields={{ sizeField, colorField, opacityField }}
        />
      )}
    </div>
  )
}
