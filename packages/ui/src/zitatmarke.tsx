/**
 * Zitatmarke (D12k, Plan `story-dreiteilung-fragenchronik`): die Nummer eines
 * Belegs als Kreis in fester Groesse — im Antworttext kleiner, an der
 * Belegkarte groesser. Dieselbe Form fuer 1 und 56; kein Schriftzeichen, das
 * bei 21 ausgeht.
 *
 * Der Antworttext ist gerendertes HTML, dort kommt die Klasse als Zeichenkette
 * an den Anker (`zitatmarkeKlasse`); die Karte nutzt die Komponente. Die
 * `!`-Modifikatoren halten die Typografie-Regeln von `prose` (Unterstreichung,
 * Linkfarbe) vom Anker fern.
 */

import type { HTMLAttributes } from 'react'
import { cn } from '@ks/util'

export type ZitatmarkeGroesse = 'text' | 'karte'

const GRUND =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold leading-none !text-primary-foreground !no-underline'

const GROESSE: Record<ZitatmarkeGroesse, string> = {
  text: 'mx-px h-5 min-w-5 px-1 align-text-bottom text-xs',
  karte: 'h-7 min-w-7 px-1.5 text-sm',
}

/** Tailwind-Klassen der Marke — fuer HTML, das nicht durch React laeuft. */
export function zitatmarkeKlasse(groesse: ZitatmarkeGroesse): string {
  return `${GRUND} ${GROESSE[groesse]}`
}

export interface ZitatmarkeProps extends HTMLAttributes<HTMLSpanElement> {
  nummer: number
  groesse?: ZitatmarkeGroesse
}

export function Zitatmarke({ nummer, groesse = 'karte', className, ...rest }: ZitatmarkeProps) {
  return (
    <span className={cn(zitatmarkeKlasse(groesse), className)} {...rest}>
      {nummer}
    </span>
  )
}
