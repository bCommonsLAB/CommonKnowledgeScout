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
import { nodeColor, nodeOpacity, nodeRadius, hubRadius, maxOf } from './graph-encodings'

interface Encodings { sizeField?: string; colorField?: string; opacityField?: string; colorMap?: Record<string, string> }

interface DocGraphSceneProps {
  data: GraphData
  docs: DocCardMeta[]
  encodings: Encodings
  width: number
  height: number
  onOpenDocument: (doc: DocCardMeta) => void
}

export function DocGraphScene({ data, docs, encodings, width, height, onOpenDocument }: DocGraphSceneProps) {
  const { sizeField, colorField, opacityField, colorMap } = encodings
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const domainMax = useMemo(() => maxOf(docs, sizeField), [docs, sizeField])
  const radiusOf = useCallback(
    (n: GraphNode) => (n.kind === 'hub' ? hubRadius(n.hubCount ?? 1) : nodeRadius(n.doc as DocCardMeta, sizeField, domainMax)),
    [sizeField, domainMax],
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
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {data.links.map((l, i) => {
            const s = l.source as GraphNode, t = l.target as GraphNode
            if (typeof s !== 'object' || typeof t !== 'object') return null
            const visible = !neighbors || (neighbors.has(s.id) && neighbors.has(t.id))
            return (
              <line
                key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="currentColor" className="text-muted-foreground"
                strokeOpacity={visible ? 0.35 : 0.05}
                strokeWidth={Math.min(5, 0.6 + l.weight)}
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
                <circle
                  r={r} fill={fill} fillOpacity={opacity}
                  stroke={isHub ? '#475569' : '#ffffff'} strokeWidth={isHub ? 1.5 : 1}
                  strokeDasharray={isHub ? '3 2' : undefined}
                />
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
