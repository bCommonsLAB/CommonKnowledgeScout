'use client'

/**
 * Die gesetzten Filter als Chips mit „Zurücksetzen" (D12o): „gefiltert:
 * Arbeitsgruppe: Energie ✕ Zurücksetzen". Liest die Filter aus dem geteilten
 * Zustand (`galleryFiltersAtom`), die Beschriftung aus den Facetten-
 * Definitionen. Ohne gesetzten Filter rendert sie nichts.
 *
 * Steht in der Filterleiste der Galerie und — damit man im Story-Modus
 * sieht, dass man gefiltert ist — als Slot in der Story-Mitte neben den
 * Kennzahlen (Owner 03.10.: die Quellen-Spalte ist beim Einstieg zu, dort
 * sah niemand den Filter).
 */

import { useAtomValue } from 'jotai'
import { X } from 'lucide-react'
import { Badge, Button } from '@ks/ui'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import { galleryFiltersAtom } from '../atoms/gallery-filters'

/** Das, was die Chips von einer Facette brauchen — wie in der Filterleiste. */
export interface FacetBeschriftung {
  metaKey: string
  label: string
}

export interface FilterChipsProps {
  facetDefs?: FacetBeschriftung[]
  onClear: () => void
  className?: string
}

export interface AktiverFilter {
  key: string
  value: string
}

/** Gesetzte Filter als Anzeige-Paare; `shortTitle` heisst „Dokument". */
export function aktiveFilter(
  filters: Record<string, string[] | undefined>,
  facetDefs: FacetBeschriftung[],
  dokumentLabel: string,
): AktiverFilter[] {
  const labels = new Map(facetDefs.map((def) => [def.metaKey, def.label || def.metaKey]))
  const aktiv: AktiverFilter[] = []
  for (const [key, values] of Object.entries(filters)) {
    if (!Array.isArray(values) || values.length === 0) continue
    const anzeige = key === 'shortTitle' ? dokumentLabel : labels.get(key) ?? key
    for (const value of values) aktiv.push({ key: anzeige, value: String(value) })
  }
  return aktiv
}

export function FilterChips({ facetDefs = [], onClear, className }: FilterChipsProps) {
  const { t } = useTranslation()
  const filters = useAtomValue(galleryFiltersAtom) as Record<string, string[] | undefined>
  const aktiv = aktiveFilter(filters, facetDefs, t('gallery.document'))
  if (aktiv.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-filter-chips>
      <span className="shrink-0 text-sm text-muted-foreground">{t('gallery.filtered')}:</span>
      {aktiv.map((f, i) => (
        <Badge key={`${f.key}-${f.value}-${i}`} variant="secondary" className="shrink-0 text-xs">
          {f.key}: {f.value}
        </Badge>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} className="h-7 shrink-0 px-2">
        <X className="mr-1 h-3 w-3" />
        {t('gallery.reset')}
      </Button>
    </div>
  )
}
