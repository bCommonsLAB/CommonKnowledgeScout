'use client'

/**
 * DocGraphTooltip — Hover-/Auswahl-Panel für einen Graph-Knoten.
 *
 * Generisch: zeigt Titel, das Rating (falls vorhanden) und die Werte der
 * konfigurierten Encoding-Felder (Größe/Farbe/Deckkraft) inkl. zugehöriger
 * `*_begruendung`, falls vorhanden. Kennt keine festen Klima-Felder.
 */

import type { DocCardMeta } from '@/lib/gallery/types'
import { readNumber, readString } from './graph-encodings'

interface DocGraphTooltipProps {
  doc: DocCardMeta
  /** Position (Container-Koordinaten in px). */
  x: number
  y: number
  fields: { sizeField?: string; colorField?: string; opacityField?: string }
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function DocGraphTooltip({ doc, x, y, fields }: DocGraphTooltipProps) {
  const rows: Array<{ key: string; label: string; value: string; reason?: string }> = []
  const add = (key?: string) => {
    if (!key) return
    const num = readNumber(doc, key)
    const str = readString(doc, key)
    if (num === null && str === null) return
    const reason = readString(doc, `${key}_begruendung`) ?? undefined
    rows.push({ key, label: key, value: num !== null ? fmt(num) : (str ?? ''), reason })
  }
  add(fields.sizeField)
  add(fields.colorField)
  add(fields.opacityField)

  return (
    <div
      className="pointer-events-none absolute z-30 max-w-xs rounded-md border bg-popover/95 p-3 text-xs shadow-md backdrop-blur"
      style={{ left: x + 12, top: y + 12 }}
    >
      <div className="mb-1 font-semibold text-sm leading-tight">{doc.title || doc.shortTitle || doc.slug || doc.id}</div>
      {typeof doc.prioritaets_index === 'number' && (
        <div className="mb-1 text-muted-foreground">Prioritäts-Indikator: {doc.prioritaets_index.toFixed(1)}</div>
      )}
      {rows.length === 0 ? (
        <div className="text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              <span className="font-medium">{r.label}:</span> {r.value}
              {r.reason ? <div className="text-muted-foreground">{r.reason}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
