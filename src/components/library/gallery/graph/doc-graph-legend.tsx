'use client'

/**
 * DocGraphLegend — kompakte Legende für die generischen Knoten-Encodings.
 *
 * Zeigt die belegten Encoding-Felder (Größe/Farbe/Deckkraft) und — falls eine
 * `colorMap` konfiguriert ist — die Farb-Zuordnung. Rein darstellend.
 */

import { useTranslation } from '@/lib/i18n/hooks'

interface DocGraphLegendProps {
  sizeField?: string
  colorField?: string
  opacityField?: string
  colorMap?: Record<string, string>
  nodeCount: number
  edgeCount: number
}

export function DocGraphLegend(props: DocGraphLegendProps) {
  const { sizeField, colorField, opacityField, colorMap, nodeCount, edgeCount } = props
  const { t } = useTranslation()

  return (
    <div className="absolute bottom-3 left-3 z-20 max-w-[16rem] rounded-md border bg-background/90 p-3 text-xs shadow-sm backdrop-blur">
      <div className="mb-1 font-medium text-muted-foreground">
        {nodeCount} {t('gallery.graph.nodes')} · {edgeCount} {t('gallery.graph.edges')}
      </div>
      {sizeField ? (
        <div><span className="font-medium">{t('gallery.graph.legendSize')}:</span> {sizeField}</div>
      ) : null}
      {opacityField ? (
        <div><span className="font-medium">{t('gallery.graph.legendOpacity')}:</span> {opacityField}</div>
      ) : null}
      {colorField ? (
        <div className="mt-1">
          <div className="font-medium">{t('gallery.graph.legendColor')}: {colorField}</div>
          {colorMap ? (
            <ul className="mt-1 space-y-0.5">
              {Object.entries(colorMap).map(([value, color]) => (
                <li key={value} className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: color }} />
                  <span className="truncate">{value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
