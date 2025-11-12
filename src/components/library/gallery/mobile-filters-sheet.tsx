'use client'

import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { FacetGroup } from './facet-group'
import { useTranslation } from '@/lib/i18n/hooks'

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
  const { t } = useTranslation()
  
  // Erstelle eine Map für Dokumentennamen (fileId -> title)
  const docTitleMap = new Map<string, string>()
  docs.forEach(doc => {
    const id = doc.fileId || doc.id
    if (id) {
      const title = doc.shortTitle || doc.title || id
      docTitleMap.set(id, title)
    }
  })
  
  // Extrahiere fileId-Filter
  const fileIdFilter = selected.fileId
  const hasFileIdFilter = Array.isArray(fileIdFilter) && fileIdFilter.length > 0
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{title}</SheetTitle>
          {description ? <SheetDescription className="text-sm">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {/* Dokumentenfilter - spezielle Behandlung */}
          {hasFileIdFilter && (
            <div className="border rounded p-2 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/10 dark:to-cyan-950/10">
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <div className="text-sm font-medium truncate flex-1 min-w-0">{t('gallery.document')}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange('fileId', [])}
                  className="h-6 px-2 text-xs shrink-0"
                >
                  {t('gallery.reset')}
                </Button>
              </div>
              <div className="space-y-1">
                {fileIdFilter.map((fileId) => {
                  const docTitle = docTitleMap.get(fileId) || fileId
                  return (
                    <div
                      key={fileId}
                      className="flex items-center justify-between rounded px-2 py-1 bg-primary/10 text-sm"
                    >
                      <span title={docTitle} className="truncate flex-1 min-w-0 pr-2">{docTitle}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const remaining = fileIdFilter.filter(id => id !== fileId)
                          onChange('fileId', remaining)
                        }}
                        className="h-5 w-5 p-0 shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Normale Facetten-Filter */}
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





