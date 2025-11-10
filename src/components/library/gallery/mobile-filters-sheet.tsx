'use client'

import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { FacetGroup } from './facet-group'

export interface MobileFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  facetDefs: Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>
  selected: Record<string, string[] | undefined>
  onChange: (name: string, values: string[]) => void
  title: string
  description?: string
}

export function MobileFiltersSheet({ open, onOpenChange, facetDefs, selected, onChange, title, description }: MobileFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{title}</SheetTitle>
          {description ? <SheetDescription className="text-sm">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {facetDefs.filter(Boolean).map(def => {
            const cols = (def as { columns?: number })?.columns || 1
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
        </div>
      </SheetContent>
    </Sheet>
  )
}


