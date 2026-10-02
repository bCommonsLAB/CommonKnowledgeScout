'use client'

/**
 * Ansichtszeile unter dem Kopf der Seite (Figma „Schritt 7 · Kopf fuer beide
 * Ansichten", D10b): links der Name der Ansicht („Inhalte erkunden",
 * „Story-Modus") mit rundem ⓘ-Knopf, rechts die Werkzeuge der Ansicht.
 * Der ⓘ-Knopf klappt die Erklaerung der Ansicht direkt darunter auf; im
 * Kasten rechts oben klappt ein runder Pfeil nach oben sie wieder ein — ohne
 * Lesen verstaendlich. Ob sie offen ist, entscheidet der Gastgeber
 * (`useAnsichtErklaerung`: beim ersten Besuch auf, der Browser merkt sich zu).
 *
 * Reine Darstellung: alle Texte kommen herein, kein i18n, keine Library.
 */

import type { ReactNode } from 'react'
import { ChevronUp, Info } from 'lucide-react'
import { cn } from '@ks/util'

export interface AnsichtsErklaerung {
  titel: string
  text: string
  offen: boolean
  onToggle: () => void
  /** Beschriftungen fuer Vorlesen und Tooltip (uebersetzt vom Gastgeber). */
  labels: { oeffnen: string; schliessen: string }
}

export interface AnsichtsZeileProps {
  /** Name der Ansicht, gern mit Symbol. */
  name: ReactNode
  erklaerung: AnsichtsErklaerung
  /** Werkzeuge der Ansicht rechts (Suche, Knoepfe, Plaketten). */
  werkzeuge?: ReactNode
  /** Beim Scrollen eingeklappt: die Erklaerung geht zu, die Zeile bleibt. */
  eingeklappt?: boolean
  className?: string
}

const rund =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function AnsichtsZeile({ name, erklaerung, werkzeuge, eingeklappt = false, className }: AnsichtsZeileProps) {
  const offen = erklaerung.offen && !eingeklappt
  return (
    <div className={cn('space-y-2', className)} data-ansichts-zeile>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold">{name}</span>
          <button
            type="button"
            onClick={erklaerung.onToggle}
            aria-expanded={offen}
            aria-label={offen ? erklaerung.labels.schliessen : erklaerung.labels.oeffnen}
            title={offen ? erklaerung.labels.schliessen : erklaerung.labels.oeffnen}
            className={cn(
              rund,
              offen ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        {werkzeuge && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{werkzeuge}</div>}
      </div>
      {offen && (
        <section className="rounded-lg bg-muted/40 px-4 py-3" aria-label={erklaerung.titel} data-ansicht-erklaerung>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium leading-snug">{erklaerung.titel}</p>
            <button
              type="button"
              onClick={erklaerung.onToggle}
              aria-label={erklaerung.labels.schliessen}
              title={erklaerung.labels.schliessen}
              className={cn(rund, 'border-input bg-background text-muted-foreground hover:text-foreground')}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{erklaerung.text}</p>
        </section>
      )}
    </div>
  )
}
