'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Filter } from 'lucide-react'
import { FacetGroup } from './facet-group'

export interface FiltersPanelProps {
  facetDefs: Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>
  selected: Record<string, string[] | undefined>
  onChange: (name: string, values: string[]) => void
  title: string
  description?: string
}

export function FiltersPanel({ facetDefs, selected, onChange, title, description }: FiltersPanelProps) {
  return (
    <aside className="flex flex-col min-h-0 overflow-hidden h-full">
      <ScrollArea className="flex-1 min-h-0 h-full">
        <div className="pr-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                {title}
              </CardTitle>
              {description ? <CardDescription className="text-sm">{description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-6">
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
              {facetDefs.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Keine Filter verfügbar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </aside>
  )
}


