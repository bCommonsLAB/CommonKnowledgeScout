'use client'

/**
 * @fileoverview Kompaktes DIVA-Werkzeug-Menue (Popover) fuer die Dateiliste.
 *
 * @description
 * Buendelt den 3-Wege-Filter (Alle/Mit/Ohne DIVA-Info) + die Gruppierung in
 * einem Popover, damit die Toolbar nicht ueberlaeuft. Der Trigger zeigt einen
 * Aktiv-Indikator, wenn Filter oder Gruppierung gesetzt sind.
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { annotationFilterModeAtom, groupByAttributeAtom } from '@/atoms/library-atom'
import { DivaInfoFilter } from './diva-info-filter'
import { GroupByControl } from './group-by-control'

export function DivaToolsMenu(): React.ReactElement {
  const mode = useAtomValue(annotationFilterModeAtom)
  const groupBy = useAtomValue(groupByAttributeAtom)
  const isActive = mode !== 'all' || groupBy !== null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          title="DIVA-Filter & Gruppierung"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          DIVA
          {isActive && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Anzeigen</Label>
          <DivaInfoFilter stacked />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Gruppieren</Label>
          <GroupByControl className="h-8 w-full text-xs" />
        </div>
      </PopoverContent>
    </Popover>
  )
}
