'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/hooks'

export interface FacetOption { value: string | number; count: number }

export interface FacetGroupProps {
  label: string
  options: Array<string | number | FacetOption>
  selected: Array<string>
  onChange: (values: string[]) => void
}

export function FacetGroup({ label, options, selected, onChange }: FacetGroupProps) {
  const isFacetOption = (o: unknown): o is FacetOption => !!o && typeof o === 'object' && 'value' in (o as Record<string, unknown>)
  const normalized: FacetOption[] = options.map(o => (isFacetOption(o) ? o : { value: o as (string | number), count: 0 }))
  const values = new Set(selected)
  function toggle(v: string) {
    const next = new Set(values)
    if (next.has(v)) next.delete(v); else next.add(v)
    onChange(Array.from(next))
  }
  
  const { t } = useTranslation()
  
  return (
    <div className='border rounded p-2 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/10 dark:to-cyan-950/10'>
      <div className='flex items-center gap-2 mb-2 min-w-0'>
        <div className='text-sm font-medium truncate flex-1 min-w-0'>{label}</div>
        <button className='text-xs text-muted-foreground hover:underline shrink-0' onClick={() => onChange([])}>{t('gallery.reset')}</button>
      </div>
      <div className='max-h-40 overflow-auto space-y-1'>
        {normalized.map((o) => {
          const v = String(o.value)
          const active = values.has(v)
          return (
            <button
              key={v}
              type='button'
              onClick={() => toggle(v)}
              className={`w-full grid grid-cols-[1fr_auto] items-center rounded px-2 py-1 text-left text-sm ${active ? 'bg-primary/10' : 'hover:bg-muted'} min-w-0`}
            >
              <span title={v} className='truncate min-w-0 pr-2'>{v}</span>
              <span className='text-xs text-muted-foreground justify-self-end ml-2 min-w-[2.5rem] text-right tabular-nums'>{o.count > 0 ? o.count : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}


