'use client'

/**
 * Linke Spalte des Reiters „Korrektur": das Transkript Absatz fuer Absatz.
 * Jeder Sprecher hat eine feste Farbe; vor dem Absatz steht das Label — oder
 * der Name, sobald rechts einer eingetragen ist (noch nicht geschrieben).
 * Reine Darstellung, kein Zustand.
 */

import * as React from 'react'
import type { TranskriptAbsatz } from '@/lib/transkript-korrektur/absaetze'
import type { SprecherZeile } from './audio-correction-types'

/** Feste Farbreihe je Sprecher-Index; Text- und Randfarbe gehoeren zusammen. */
export const SPRECHER_FARBEN: ReadonlyArray<{ text: string; rand: string; punkt: string }> = [
  { text: 'text-sky-700 dark:text-sky-300', rand: 'border-sky-400', punkt: 'bg-sky-500' },
  { text: 'text-emerald-700 dark:text-emerald-300', rand: 'border-emerald-400', punkt: 'bg-emerald-500' },
  { text: 'text-violet-700 dark:text-violet-300', rand: 'border-violet-400', punkt: 'bg-violet-500' },
  { text: 'text-amber-700 dark:text-amber-300', rand: 'border-amber-400', punkt: 'bg-amber-500' },
  { text: 'text-rose-700 dark:text-rose-300', rand: 'border-rose-400', punkt: 'bg-rose-500' },
  { text: 'text-teal-700 dark:text-teal-300', rand: 'border-teal-400', punkt: 'bg-teal-500' },
  { text: 'text-fuchsia-700 dark:text-fuchsia-300', rand: 'border-fuchsia-400', punkt: 'bg-fuchsia-500' },
  { text: 'text-orange-700 dark:text-orange-300', rand: 'border-orange-400', punkt: 'bg-orange-500' },
]

export function sprecherFarbe(index: number) {
  return SPRECHER_FARBEN[index % SPRECHER_FARBEN.length]
}

/** DOM-Id eines Absatzes — Ziel fuer „zur ersten Stelle springen". */
export function absatzId(index: number): string {
  return `korrektur-absatz-${index}`
}

interface Props {
  absaetze: TranskriptAbsatz[]
  /** Reihenfolge = Farbindex. Name (falls aktiv und gesetzt) ersetzt das Label in der Anzeige. */
  sprecher: SprecherZeile[]
}

export function AudioCorrectionText({ absaetze, sprecher }: Props) {
  const anzeige = React.useMemo(() => {
    const map = new Map<string, { farbe: ReturnType<typeof sprecherFarbe>; name: string }>()
    sprecher.forEach((z, i) => {
      const name = z.aktiv && z.name.trim() !== '' ? z.name.trim() : z.label
      map.set(z.label, { farbe: sprecherFarbe(i), name })
    })
    return map
  }, [sprecher])

  if (absaetze.length === 0) {
    return <p className="text-xs text-muted-foreground">Das Transkript hat keinen Text.</p>
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {absaetze.map((a) => {
        const s = a.label ? anzeige.get(a.label) : undefined
        return (
          <div
            key={a.index}
            id={absatzId(a.index)}
            className={`border-l-2 pl-3 ${s ? s.farbe.rand : 'border-transparent'}`}
          >
            {s && (
              <span className={`mr-2 font-medium ${s.farbe.text}`} title={a.label ?? undefined}>
                {s.name}:
              </span>
            )}
            <span className="whitespace-pre-wrap">{a.text}</span>
          </div>
        )
      })}
    </div>
  )
}
