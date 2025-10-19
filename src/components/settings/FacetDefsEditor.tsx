"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export interface FacetDefUi {
  metaKey: string
  label?: string
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'
  multi: boolean
  visible: boolean
}

export function FacetDefsEditor({ value, onChange }: { value: FacetDefUi[]; onChange: (v: FacetDefUi[]) => void }) {
  const defs = (value || []).map(d => ({ multi: true, visible: true, type: 'string', ...d }))
  const types: FacetDefUi['type'][] = ['string','number','boolean','string[]','date','integer-range']

  function update(index: number, patch: Partial<FacetDefUi>) {
    const next = defs.map((d, i) => (i === index ? { ...d, ...patch } : d))
    onChange(next)
  }
  function add() {
    onChange([ ...defs, { metaKey: '', label: '', type: 'string', multi: true, visible: true } ])
  }
  function remove(index: number) {
    onChange(defs.filter((_, i) => i !== index))
  }
  function move(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= defs.length) return
    const next = defs.slice()
    const [it] = next.splice(index, 1)
    next.splice(j, 0, it)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 w-[28%]">metaKey</th>
              <th className="px-3 py-2 w-[28%]">Label</th>
              <th className="px-3 py-2 w-[18%]">Typ</th>
              <th className="px-3 py-2 w-[12%]">Multi</th>
              <th className="px-3 py-2 w-[12%]">Sichtbar</th>
              <th className="px-3 py-2 w-[150px]">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {defs.map((d, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 align-middle">
                  <Input placeholder="metaKey" value={d.metaKey} onChange={e => update(i, { metaKey: e.target.value })} />
                </td>
                <td className="px-3 py-2 align-middle">
                  <Input placeholder="Label" value={d.label || ''} onChange={e => update(i, { label: e.target.value })} />
                </td>
                <td className="px-3 py-2 align-middle">
                  <Select value={d.type} onValueChange={(v) => update(i, { type: v as FacetDefUi['type'] })}>
                    <SelectTrigger><SelectValue placeholder="Typ" /></SelectTrigger>
                    <SelectContent>
                      {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 align-middle">
                  <Switch checked={!!d.multi} onCheckedChange={(v) => update(i, { multi: v })} />
                </td>
                <td className="px-3 py-2 align-middle">
                  <Switch checked={!!d.visible} onCheckedChange={(v) => update(i, { visible: v })} />
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => move(i, +1)} disabled={i === defs.length - 1}>↓</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>Entfernen</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="secondary" onClick={add}>Facette hinzufügen</Button>
    </div>
  )
}


