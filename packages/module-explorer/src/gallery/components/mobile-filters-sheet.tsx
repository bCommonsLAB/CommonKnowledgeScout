'use client'

import React from 'react'
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@ks/ui'
import { DocumentFilterGroup } from './document-filter-group'
import { FacetsList } from './facets-list'
import { ViewTypeLeadFilter } from './view-type-lead-filter'

export interface MobileFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  facetDefs: Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>
  selected: Record<string, string[] | undefined>
  onChange: (name: string, values: string[]) => void
  title: string
  description?: string
  /** A4a — Typ-Leitfilter (gemischte Libraries). Optional. */
  viewTypes?: string[]
  selectedViewType?: string | null
  onSelectViewType?: (viewType: string | null) => void
  /** Von welcher Seite die Lade kommt: links (mobil, Vorgabe) oder rechts (geführtes Profil, G1). */
  side?: 'left' | 'right'
  /**
   * Fußzeile (G1): „Zurücksetzen" und ein Knopf, der die Lade schließt und
   * sagt, wie viele Einträge der Filter übrig lässt. Ohne Angabe keine Fußzeile.
   */
  fuss?: { anzahl: number; anwendenLabel: string; resetLabel: string; onReset: () => void }
}

export function MobileFiltersSheet({ open, onOpenChange, facetDefs, selected, onChange, title, description, viewTypes, selectedViewType, onSelectViewType, side = 'left', fuss }: MobileFiltersSheetProps) {
  // Extrahiere shortTitle-Filter
  const shortTitleFilter = selected.shortTitle
  const hasShortTitleFilter = Array.isArray(shortTitleFilter) && shortTitleFilter.length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{title}</SheetTitle>
          {description ? <SheetDescription className="text-sm">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {/* A4a — Typ-Leitfilter zuerst (erscheint nur bei >= 2 Typen) */}
          {viewTypes && onSelectViewType ? (
            <ViewTypeLeadFilter
              viewTypes={viewTypes}
              selected={selectedViewType ?? null}
              onSelect={onSelectViewType}
            />
          ) : null}

          {/* Dokumentenfilter - spezielle Behandlung */}
          {hasShortTitleFilter && (
            <DocumentFilterGroup
              shortTitles={shortTitleFilter}
              onReset={() => onChange('shortTitle', [])}
              onRemove={(shortTitle) => {
                const remaining = shortTitleFilter.filter(title => title !== shortTitle)
                onChange('shortTitle', remaining)
              }}
            />
          )}
          
          {/* Normale Facetten-Filter */}
          <FacetsList
            facetDefs={facetDefs}
            selected={selected}
            onChange={onChange}
          />
        </div>
        {fuss ? (
          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={fuss.onReset}>{fuss.resetLabel}</Button>
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>{fuss.anwendenLabel}</Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}





