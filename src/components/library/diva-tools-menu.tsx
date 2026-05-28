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
import {
  annotationFilterModeAtom,
  divaSidecarStatusAtom,
  groupByAttributeAtom,
} from '@/atoms/library-atom'
import { cn } from '@/lib/utils'
import { DivaInfoFilter } from './diva-info-filter'
import { GroupByControl } from './group-by-control'
import { ExtraColumnsControl } from './extra-columns-control'

export function DivaToolsMenu(): React.ReactElement {
  const mode = useAtomValue(annotationFilterModeAtom)
  const groupBy = useAtomValue(groupByAttributeAtom)
  const sidecar = useAtomValue(divaSidecarStatusAtom)
  const isActive = mode !== 'all' || groupBy !== null
  const sidecarFound = sidecar.state === 'loaded' && sidecar.found

  // Tooltip-Text: spiegelt Sidecar-Status + Filter-/Gruppierungs-Zustand wider.
  const titleParts: string[] = ['DIVA-Filter & Gruppierung']
  if (sidecar.state === 'loaded') {
    titleParts.push(
      sidecarFound
        ? `Sidecar gefunden${
            typeof sidecar.entryCount === 'number' ? ` (${sidecar.entryCount} Eintraege)` : ''
          }`
        : 'Sidecar fehlt — api2_GetJsonOptionValues.json nicht im Ordner',
    )
  } else if (sidecar.state === 'error') {
    titleParts.push('Sidecar-Status konnte nicht geladen werden')
  }

  // Drei visuelle Zustaende:
  //  - Sidecar gefunden  → orange Tint, damit der Klassifizierer sofort sieht
  //    dass in diesem Ordner DIVA-Daten zur Verfuegung stehen.
  //  - Filter/Gruppierung aktiv (ohne Sidecar-Treffer)  → Primary (default).
  //  - Sonst  → outline.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={sidecarFound || isActive ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-8 gap-1.5 text-xs',
            sidecarFound &&
              'bg-orange-500 text-white hover:bg-orange-500/90 dark:bg-orange-600 dark:hover:bg-orange-600/90 border-transparent',
          )}
          title={titleParts.join(' · ')}
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
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Zusatzspalten</Label>
          <ExtraColumnsControl className="w-full" />
        </div>
      </PopoverContent>
    </Popover>
  )
}
