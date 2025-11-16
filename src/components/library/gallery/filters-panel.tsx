'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Filter } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { DocumentFilterGroup } from './document-filter-group'
import { FacetsList } from './facets-list'

export interface FiltersPanelProps {
  facetDefs: Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>
  selected: Record<string, string[] | undefined>
  onChange: (name: string, values: string[]) => void
  title: string
  description?: string
  docs?: Array<{ fileId?: string; id?: string; title?: string; shortTitle?: string }> // Optional: Dokumentenliste für fileId-Filter-Anzeige
}

export function FiltersPanel({ facetDefs, selected, onChange, title, description, docs = [] }: FiltersPanelProps) {
  const { t } = useTranslation()
  
  // Extrahiere fileId-Filter
  const fileIdFilter = selected.fileId
  const hasFileIdFilter = Array.isArray(fileIdFilter) && fileIdFilter.length > 0
  
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
              {/* Dokumentenfilter - spezielle Behandlung */}
              {hasFileIdFilter && (
                <DocumentFilterGroup
                  fileIds={fileIdFilter}
                  docs={docs}
                  onReset={() => onChange('fileId', [])}
                  onRemove={(fileId) => {
                    const remaining = fileIdFilter.filter(id => id !== fileId)
                    onChange('fileId', remaining)
                  }}
                />
              )}
              
              {/* Normale Facetten-Filter */}
              <FacetsList
                facetDefs={facetDefs}
                selected={selected}
                onChange={onChange}
              />
              {facetDefs.length === 0 && !hasFileIdFilter && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t('gallery.noFiltersAvailable')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </aside>
  )
}


