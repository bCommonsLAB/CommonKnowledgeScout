'use client'

/**
 * DocGraph — generischer Beziehungs-/Metadaten-Graph als dritter Galerie-Modus.
 *
 * Orchestriert die Kantenquellen-Auswahl, baut die Graph-Daten (Welle 2: nur
 * Quelle B / gemeinsame Metadaten) und rendert Selector + Szene + Legende.
 * Knoten = die übergebenen, gefilterten Dokumente (teilt den Galerie-Bestand);
 * Klick auf einen Knoten öffnet die bestehende Detailansicht (über `onOpenDocument`).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GalleryGraphConfig } from '@/types/library'
import { useTranslation } from '@/lib/i18n/hooks'
import { useSharedMetaEdges } from '@/hooks/gallery/use-shared-meta-edges'
import { EdgeSourceSelector } from './edge-source-selector'
import { DocGraphScene } from './doc-graph-scene'
import { DocGraphLegend } from './doc-graph-legend'
import type { EdgeSourceSelection } from './graph-types'

interface DocGraphProps {
  docs: DocCardMeta[]
  graph: GalleryGraphConfig
  onOpenDocument: (doc: DocCardMeta) => void
  /** Optionale Anzeigenamen je meta-Feld (aus den Facetten-Definitionen). */
  fieldLabels?: Record<string, string>
}

export function DocGraph({ docs, graph, onOpenDocument, fieldLabels }: DocGraphProps) {
  const { t } = useTranslation()
  const sharedMeta = graph.edgeSources?.sharedMeta
  const fields = useMemo(() => sharedMeta?.fields?.filter((f) => f.length > 0) ?? [], [sharedMeta?.fields])
  const defaultMode = sharedMeta?.mode ?? 'projection'

  // Initiale Auswahl: konfigurierte Default-Quelle. Quelle A/C sind in Welle 2
  // nicht implementiert → explizit auf Quelle B (erstes Feld) zurückfallen.
  const [selection, setSelection] = useState<EdgeSourceSelection | null>(() =>
    fields.length ? { kind: 'sharedMeta', field: fields[0], mode: defaultMode } : null,
  )
  const defaultNotImplemented = graph.defaultEdgeSource && graph.defaultEdgeSource !== 'sharedMeta'

  // Containergröße messen (ResizeObserver) für das SVG-Layout.
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ width: Math.floor(r.width), height: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeField = selection?.kind === 'sharedMeta' ? selection.field : (fields[0] ?? '')
  const activeMode = selection?.kind === 'sharedMeta' ? selection.mode : defaultMode
  const data = useSharedMetaEdges({
    docs,
    field: activeField,
    mode: activeMode,
    minShared: sharedMeta?.minShared,
    maxEdgesPerNode: graph.maxEdgesPerNode,
    maxEdgesTotal: graph.maxEdgesTotal,
  })

  if (!fields.length) {
    return <div className="p-6 text-sm text-muted-foreground">{t('gallery.graph.noFields')}</div>
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col gap-2">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2">
        {selection && (
          <EdgeSourceSelector
            selection={selection}
            onChange={setSelection}
            sharedMetaFields={fields}
            fieldLabels={fieldLabels}
          />
        )}
        {defaultNotImplemented && (
          <span className="text-xs text-muted-foreground">{t('gallery.graph.comingSoon')}</span>
        )}
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-hidden rounded-md border bg-muted/20">
        {size.width > 0 && data.links.length === 0 ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {t('gallery.graph.noEdges')}
          </div>
        ) : null}
        {size.width > 0 && (
          <DocGraphScene
            data={data}
            docs={docs}
            encodings={{
              sizeField: graph.sizeField,
              colorField: graph.colorField,
              opacityField: graph.opacityField,
              colorMap: graph.colorMap,
            }}
            width={size.width}
            height={size.height}
            onOpenDocument={onOpenDocument}
          />
        )}
        <DocGraphLegend
          sizeField={graph.sizeField}
          colorField={graph.colorField}
          opacityField={graph.opacityField}
          colorMap={graph.colorMap}
          nodeCount={data.nodes.length}
          edgeCount={data.links.length}
        />
      </div>
    </div>
  )
}
