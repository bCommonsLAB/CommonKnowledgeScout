'use client'

import React from 'react'
import { FacetGroup } from './facet-group'

export interface FacetDef {
  metaKey: string
  label: string
  type: string
  options: Array<{ value: string; count: number }>
  columns?: number
}

export interface FacetsListProps {
  /** Facetten-Definitionen */
  facetDefs: Array<FacetDef>
  /** Aktuell ausgewählte Filter */
  selected: Record<string, string[] | undefined>
  /** Callback wenn Filter geändert werden */
  onChange: (name: string, values: string[]) => void
}

/**
 * Komponente zur Anzeige einer Liste von Facetten-Filtern
 * Rendert alle Facetten-Definitionen als FacetGroup-Komponenten
 */
export function FacetsList({ facetDefs, selected, onChange }: FacetsListProps) {
  return (
    <>
      {facetDefs.filter(Boolean).map(def => {
        const cols = def.columns || 1
        return (
          <div key={def.metaKey} className={cols === 2 ? 'grid grid-cols-2 gap-2' : ''}>
            <FacetGroup
              label={def.label || def.metaKey}
              options={def.options}
              selected={selected[def.metaKey] || []}
              onChange={(vals: string[]) => onChange(def.metaKey, vals)}
            />
          </div>
        )
      })}
    </>
  )
}








