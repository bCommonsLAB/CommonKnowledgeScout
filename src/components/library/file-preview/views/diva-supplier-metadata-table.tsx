'use client'

/**
 * @fileoverview Metadaten-Tabelle fuer den DIVA-Info-Tab (Stufe 1).
 *
 * @description
 * Reine Praesentations-Komponente: zeigt die Liefersystem-Stammdaten als
 * Definitionsliste inkl. RGB-Farbswatch. Ausgegliedert aus
 * diva-supplier-data-view.tsx (200-Zeilen-Regel).
 */

import * as React from 'react'
import type { OptionvalueEntry } from '@/lib/diva-texture/types'

const META_ROWS: Array<{ key: keyof OptionvalueEntry; label: string }> = [
  { key: 'Name', label: 'Name' },
  { key: 'GroupName', label: 'Stoffgruppe' },
  { key: 'Material', label: 'Material' },
  { key: 'VCodex', label: 'VCodex' },
  { key: 'PFTFile', label: 'PFTFile' },
  { key: 'TextureName', label: 'TextureName' },
]

export function DivaSupplierMetadataTable({ entry }: { entry: OptionvalueEntry }) {
  const rgbHex = entry.RGB ? `#${entry.RGB.replace(/^#/, '')}` : null

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border bg-card p-4 text-sm sm:grid-cols-2">
      {META_ROWS.map(({ key, label }) => {
        const value = entry[key]
        if (typeof value !== 'string' || value.trim() === '') return null
        return (
          <React.Fragment key={key}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </React.Fragment>
        )
      })}
      {rgbHex ? (
        <>
          <dt className="text-muted-foreground">RGB</dt>
          <dd className="flex items-center gap-2 font-medium">
            <span className="inline-block h-4 w-4 rounded border" style={{ backgroundColor: rgbHex }} />
            <span className="font-mono">{rgbHex}</span>
          </dd>
        </>
      ) : null}
    </dl>
  )
}
