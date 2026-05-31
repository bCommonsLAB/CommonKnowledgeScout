'use client'

/**
 * GraphControls — Live-Mini-Editor neben dem Graph-Header (Welle 2).
 *
 * Erlaubt schnelles Experimentieren OHNE die Library-Config zu ändern: welche
 * Felder Kanten bilden (`fields`), Hub vs. Projektion (`mode`), Mindest-
 * Überschneidung (`minShared`) und die Farbzuordnung (`colorMap`). Reiner
 * UI-Editor über lokalen State des Eltern-Graphen — nichts wird persistiert.
 */

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Settings2, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { colorForValue } from './graph-encodings'

interface GraphControlsProps {
  fields: string[]
  onFieldsChange: (fields: string[]) => void
  /** Vorschläge zum Hinzufügen (kategorische/Array-meta-Keys aus den Docs). */
  availableFields: string[]
  fieldLabels?: Record<string, string>
  mode: 'hub' | 'projection'
  onModeChange: (mode: 'hub' | 'projection') => void
  minShared: number
  onMinSharedChange: (n: number) => void
  colorField?: string
  /** Distinkte Werte des colorField in der aktuellen Menge. */
  colorValues: string[]
  colorMap: Record<string, string>
  onColorMapChange: (map: Record<string, string>) => void
}

export function GraphControls(props: GraphControlsProps) {
  const {
    fields, onFieldsChange, availableFields, fieldLabels,
    mode, onModeChange, minShared, onMinSharedChange,
    colorField, colorValues, colorMap, onColorMapChange,
  } = props
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const label = (f: string) => fieldLabels?.[f] || f
  const addable = availableFields.filter((f) => !fields.includes(f))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1">
          <Settings2 className="h-4 w-4" />
          {t('gallery.graph.customize')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        {/* Felder (Verbinde nach) */}
        <div className="space-y-2">
          <Label>{t('gallery.graph.controlsFields')}</Label>
          <div className="flex flex-wrap gap-1">
            {fields.length === 0 && <span className="text-xs text-muted-foreground">{t('gallery.graph.noFields')}</span>}
            {fields.map((f) => (
              <Badge key={f} variant="secondary" className="gap-1">
                {label(f)}
                <button type="button" aria-label="remove" onClick={() => onFieldsChange(fields.filter((x) => x !== f))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {addable.length > 0 && (
            <Select value="" onValueChange={(v) => v && onFieldsChange([...fields, v])}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder={t('gallery.graph.controlsAddField')} />
              </SelectTrigger>
              <SelectContent>
                {addable.map((f) => (
                  <SelectItem key={f} value={f}>{label(f)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Modus */}
        <div className="space-y-2">
          <Label>{t('gallery.graph.controlsMode')}</Label>
          <div className="flex items-center gap-1 rounded-md border p-1">
            {(['projection', 'hub'] as const).map((m) => (
              <Button
                key={m} type="button" variant="ghost" size="sm"
                className={`h-7 flex-1 ${mode === m ? 'bg-background shadow-sm' : ''}`}
                onClick={() => onModeChange(m)}
              >
                {m === 'projection' ? t('gallery.graph.modeProjection') : t('gallery.graph.modeHub')}
              </Button>
            ))}
          </div>
          {mode === 'projection' && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{t('gallery.graph.controlsMinShared')}</Label>
              <Input
                type="number" min={1} className="h-7 w-20"
                value={minShared}
                onChange={(e) => onMinSharedChange(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}
        </div>

        {/* Farbzuordnung */}
        {colorField && colorValues.length > 0 && (
          <div className="space-y-2">
            <Label>{t('gallery.graph.controlsColors')} · {colorField}</Label>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {colorValues.map((value) => (
                <li key={value} className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0"
                    value={colorForValue(value, colorMap)}
                    onChange={(e) => onColorMapChange({ ...colorMap, [value]: e.target.value })}
                  />
                  <span className="truncate text-sm">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
