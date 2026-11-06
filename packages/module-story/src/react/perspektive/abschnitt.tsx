'use client'

/**
 * Bausteine des Perspektiv-Dialogs: ein Abschnitt (Symbol, Titel, Hilfe hinter
 * einem `?`-Symbol) und eine Plaketten-Wahl mit Tooltip je Wert. Die Tooltips
 * brauchen einen `TooltipProvider` weiter oben — App-Layout bzw. Embed-Rahmen
 * setzen ihn. Kompakt gehalten (Welle N3): die Hilfe steht im Tooltip statt als
 * Fliesstext, damit das Blatt von rechts ohne Scrollen auskommt.
 */

import type { ReactNode } from 'react'
import { HelpCircle, type LucideIcon } from 'lucide-react'
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@ks/ui'

export interface AbschnittProps {
  symbol: LucideIcon
  titel: string
  hilfe: string
  children: ReactNode
}

export function Abschnitt({ symbol: Symbol, titel, hilfe, children }: AbschnittProps) {
  return (
    <section className="rounded-lg border p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Symbol className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{titel}</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={hilfe}
                  className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{hilfe}</p>
              </TooltipContent>
            </Tooltip>
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
    <div className="flex flex-wrap gap-1.5">
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
                  className={`px-2.5 py-0.5 text-xs transition-all ${aus ? 'opacity-40' : an ? '' : 'hover:bg-primary/10'}`}
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
