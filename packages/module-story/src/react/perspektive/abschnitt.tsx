'use client'

/**
 * Bausteine des Perspektiv-Dialogs: ein Abschnitt (Symbol, Titel, Hilfe) und
 * eine Plaketten-Wahl mit Tooltip je Wert. Die Tooltips brauchen einen
 * `TooltipProvider` weiter oben — App-Layout bzw. Embed-Rahmen setzen ihn.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@ks/ui'

export interface AbschnittProps {
  symbol: LucideIcon
  titel: string
  hilfe: string
  children: ReactNode
}

export function Abschnitt({ symbol: Symbol, titel, hilfe, children }: AbschnittProps) {
  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Symbol className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold">{titel}</h3>
            <p className="text-sm text-muted-foreground">{hilfe}</p>
          </div>
          {children}
        </div>
      </div>
    </section>
  )
}

export interface PlakettenWahlProps<T extends string> {
  werte: readonly T[]
  label: (wert: T) => string
  tooltip: (wert: T) => string
  gewaehlt: (wert: T) => boolean
  gesperrt?: (wert: T) => boolean
  onWahl: (wert: T) => void
}

export function PlakettenWahl<T extends string>({ werte, label, tooltip, gewaehlt, gesperrt, onWahl }: PlakettenWahlProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {werte.map((wert) => {
        const an = gewaehlt(wert)
        const aus = gesperrt?.(wert) ?? false
        return (
          <Tooltip key={wert}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={an}
                disabled={aus}
                onClick={() => onWahl(wert)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              >
                <Badge
                  variant={an ? 'default' : 'outline'}
                  className={`px-3 py-1.5 text-sm transition-all ${aus ? 'opacity-40' : an ? '' : 'hover:bg-primary/10'}`}
                >
                  {label(wert)}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{tooltip(wert)}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
