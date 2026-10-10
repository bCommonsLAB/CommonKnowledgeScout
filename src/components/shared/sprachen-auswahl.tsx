'use client'

/**
 * Mehrfachauswahl der Sprachen einer Aufnahme — mit Namen statt Kuerzeln.
 * Leer = „Automatisch erkennen". Eine Sprache = feste Quellsprache; mehrere
 * = gemischte Aufnahme (die Transkription laesst jede Sprache im Original).
 * Die Liste ist dieselbe wie im Transkriptions-Dialog
 * (`TRANSCRIPTION_SOURCE_LANGUAGES`, zentral aus `src/lib/chat/constants.ts`).
 */

import * as React from 'react'
import { Badge, Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from '@ks/ui'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { TRANSCRIPTION_SOURCE_LANGUAGES } from '@/components/library/flow/pipeline-sheet/helpers'

const SPRACHEN = TRANSCRIPTION_SOURCE_LANGUAGES.filter((l) => l.value !== 'auto')
const NAME = new Map(SPRACHEN.map((l) => [l.value, l.label]))

export function sprachName(code: string): string {
  return NAME.get(code) ?? code
}

interface Props {
  value: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
  id?: string
}

export function SprachenAuswahl({ value, onChange, disabled, id }: Props) {
  const [offen, setOffen] = React.useState(false)
  const umschalten = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code])

  return (
    <div className="space-y-1">
      <Popover open={offen} onOpenChange={setOffen}>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" role="combobox" aria-expanded={offen} disabled={disabled} className="h-8 w-full justify-between text-xs font-normal">
            <span className="truncate">
              {value.length === 0 ? 'Automatisch erkennen' : value.map(sprachName).join(', ')}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Sprache suchen …" className="h-8 text-xs" />
            <CommandList className="max-h-[260px]">
              <CommandEmpty className="py-3 text-center text-xs">Keine Sprache gefunden.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="Automatisch erkennen" onSelect={() => onChange([])} className="text-xs">
                  <Check className={`mr-2 h-3.5 w-3.5 ${value.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                  Automatisch erkennen
                </CommandItem>
                {SPRACHEN.map((l) => (
                  <CommandItem key={l.value} value={l.label} onSelect={() => umschalten(l.value)} className="text-xs">
                    <Check className={`mr-2 h-3.5 w-3.5 ${value.includes(l.value) ? 'opacity-100' : 'opacity-0'}`} />
                    {l.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1 text-[11px] font-normal">
              {sprachName(code)}
              <button type="button" onClick={() => umschalten(code)} disabled={disabled} aria-label={`${sprachName(code)} entfernen`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
