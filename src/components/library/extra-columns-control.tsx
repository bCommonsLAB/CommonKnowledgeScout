'use client'

/**
 * @fileoverview Zusatzspalten-Picker fuer die DIVA-Toolbar (Stufe 1+).
 *
 * @description
 * Multi-Select-Dropdown, das dem Klassifizierer erlaubt, beliebige Sidecar-
 * Felder (z.B. `Material`, `TextureName`, `Image` als Thumbnail) als
 * zusaetzliche Spalten in der Dateiliste einzublenden. Reduziert den
 * Aufwand, jedes Material einzeln zu oeffnen, um die Quellbild-Qualitaet
 * einzuschaetzen.
 *
 * Auswahl wird im `divaExtraColumnsAtom` als geordnete Liste gehalten —
 * die Reihenfolge entspricht der Anzeige in der Dateiliste.
 *
 * Spezialschluessel: `_thumbnail` rendert das Preview-Bitmap aus
 * `entry.Image` (Liefersystem-URL), nicht ein rohes Text-Feld.
 */

import * as React from 'react'
import { useAtom } from 'jotai'
import { Columns3, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { divaExtraColumnsAtom } from '@/atoms/library-atom'
import { cn } from '@/lib/utils'

/**
 * Auswaehlbare Spalten. `_thumbnail` ist die spezielle Preview-Spalte, alle
 * anderen sind reine Text-Felder aus dem rohen `OptionvalueEntry`.
 *
 * Reihenfolge hier = Reihenfolge in der Dropdown-Liste (visuell sinnvolle
 * Sortierung: Thumbnail zuerst, dann sprechende Felder, dann technische IDs).
 */
const AVAILABLE_COLUMNS: Array<{ key: string; label: string }> = [
  { key: '_thumbnail', label: 'Preview-Bitmap (Liefersystem)' },
  { key: 'Material', label: 'Material' },
  { key: 'GroupName', label: 'Stoffgruppe (GroupName)' },
  { key: 'TextureName', label: 'TextureName' },
  { key: 'Name', label: 'Name' },
  { key: 'RGB', label: 'RGB (Farb-Swatch)' },
  { key: 'VCodex', label: 'VCodex' },
  { key: 'PFTFile', label: 'PFTFile' },
]

export interface ExtraColumnsControlProps {
  className?: string
}

export function ExtraColumnsControl({ className }: ExtraColumnsControlProps): React.ReactElement {
  const [columns, setColumns] = useAtom(divaExtraColumnsAtom)
  const selected = React.useMemo(() => new Set(columns), [columns])

  const toggle = (key: string): void => {
    if (selected.has(key)) {
      setColumns(columns.filter((c) => c !== key))
    } else {
      // An aktueller Reihenfolge der Verfuegbarkeitsliste anhaengen — der
      // Klassifizierer kriegt deterministische Spalten-Reihenfolge.
      setColumns([...columns, key])
    }
  }

  const clear = (): void => setColumns([])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 gap-1.5 text-xs', className)}
          title="Zusatzspalten in der Dateiliste anzeigen"
        >
          <Columns3 className="h-3.5 w-3.5" />
          {columns.length > 0 ? `${columns.length} Spalte${columns.length === 1 ? '' : 'n'}` : 'Spalten'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Sidecar-Felder als Spalten
        </DropdownMenuLabel>
        {AVAILABLE_COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={selected.has(col.key)}
            onCheckedChange={() => toggle(col.key)}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="text-xs">{col.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {columns.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={clear}
              className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              <Check className="mr-2 inline h-3 w-3" />
              Alle ausblenden
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
