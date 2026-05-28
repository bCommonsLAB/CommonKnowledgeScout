'use client'

/**
 * @fileoverview Gruppieren-Auswahl fuer die Dateiliste (generisch).
 *
 * @description
 * Setzt `groupByAttributeAtom` auf einen Annotation-Attribut-Key (oder null).
 * Die verfuegbaren Keys werden generisch aus den geladenen Annotationen
 * abgeleitet (alle String-Attribute) — DIVA liefert u.a. `stoffgruppe`,
 * `material`. Ohne annotierte Dateien rendert das Control nichts.
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { groupByAttributeAtom, itemAnnotationsAtom } from '@/atoms/library-atom'

const NONE = '__none__'

const LABELS: Record<string, string> = {
  stoffgruppe: 'Stoffgruppe',
  material: 'Material',
  textur_name: 'Textur-Name',
  farbe_hex: 'Farbe',
}

function labelFor(key: string): string {
  return LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

export function GroupByControl({ className }: { className?: string }): React.ReactElement | null {
  const [groupBy, setGroupBy] = useAtom(groupByAttributeAtom)
  const annotations = useAtomValue(itemAnnotationsAtom)

  const keys = React.useMemo(() => {
    const set = new Set<string>()
    for (const attrs of annotations.values()) {
      for (const [key, value] of Object.entries(attrs)) {
        if (typeof value === 'string' && value.trim() !== '') set.add(key)
      }
    }
    return Array.from(set).sort()
  }, [annotations])

  if (keys.length === 0) return null

  return (
    <Select value={groupBy ?? NONE} onValueChange={(v) => setGroupBy(v === NONE ? null : v)}>
      <SelectTrigger className={className ?? 'h-8 w-[150px] text-xs'} title="Dateiliste nach Attribut gruppieren">
        <SelectValue placeholder="Gruppieren" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Keine Gruppierung</SelectItem>
        {keys.map((key) => (
          <SelectItem key={key} value={key}>{labelFor(key)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
