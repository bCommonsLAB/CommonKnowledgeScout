'use client'

import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { DocumentFilterGroup } from './document-filter-group'
import { FacetsList } from './facets-list'

export interface MobileFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  facetDefs: Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>
  selected: Record<string, string[] | undefined>
  onChange: (name: string, values: string[]) => void
  title: string
  description?: string
  docs?: Array<{ fileId?: string; id?: string; title?: string; shortTitle?: string }> // Optional: Dokumentenliste für fileId-Filter-Anzeige
}

export function MobileFiltersSheet({ open, onOpenChange, facetDefs, selected, onChange, title, description, docs = [] }: MobileFiltersSheetProps) {
  // Extrahiere shortTitle-Filter
  const shortTitleFilter = selected.shortTitle
  const hasShortTitleFilter = Array.isArray(shortTitleFilter) && shortTitleFilter.length > 0
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{title}</SheetTitle>
          {description ? <SheetDescription className="text-sm">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {/* Dokumentenfilter - spezielle Behandlung */}
          {hasShortTitleFilter && (
            <DocumentFilterGroup
              shortTitles={shortTitleFilter}
              docs={docs}
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
      </SheetContent>
    </Sheet>
  )
}





