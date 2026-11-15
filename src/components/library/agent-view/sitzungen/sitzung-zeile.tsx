'use client'

/**
 * @fileoverview Eine Zeile der Sitzungs-Liste und die Zeichen B, N, R (Register, Welle R3).
 *
 * @description
 * Figma „Sitzungszeile": Datum, Werkzeug, Titel (einzeilig, gekuerzt) und drei
 * Zeichen — B Beleg, N Notiz, R im Bericht; gruen = da, leer = fehlt. Die
 * gewaehlte Zeile ist orange hinterlegt. Reine Darstellung.
 *
 * @module components/library/agent-view/sitzungen
 */

import { cn } from '@/lib/utils'
import { QUELLE_KURZ, zeilenDatum } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

export function StandZeichen({ zeichen, da, titel }: { zeichen: 'B' | 'N' | 'R'; da: boolean; titel: string }) {
  return (
    <span
      title={titel}
      className={cn(
        'inline-flex h-[17px] items-center rounded px-[5px] text-[10px] font-semibold leading-none',
        da ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'border text-muted-foreground/70',
      )}
    >
      {zeichen}
    </span>
  )
}

export function StandZeichenReihe({ zeile }: { zeile: SitzungsSicht }) {
  const beleg = zeile.belege.length > 0
  const notiz = zeile.belege.some((b) => b.notiz)
  return (
    <span className="flex shrink-0 items-center gap-[3px]">
      <StandZeichen zeichen="B" da={beleg} titel={beleg ? 'Beleg da' : 'kein Beleg'} />
      <StandZeichen zeichen="N" da={notiz} titel={notiz ? 'Notiz da' : 'keine Notiz'} />
      <StandZeichen zeichen="R" da={zeile.imBericht} titel={zeile.imBericht ? 'im Bericht' : 'nicht im Bericht'} />
    </span>
  )
}

export function SitzungZeile({
  zeile,
  gewaehlt,
  einzug,
  jahr,
  onWaehlen,
}: {
  zeile: SitzungsSicht
  gewaehlt: boolean
  /** `tief` unter einem Vorhaben, `flach` direkt unter einer Gruppe. */
  einzug: 'tief' | 'flach'
  jahr: number
  onWaehlen: (registerId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onWaehlen(zeile.registerId)}
      aria-current={gewaehlt ? 'true' : undefined}
      className={cn(
        'flex h-[34px] w-full shrink-0 items-center gap-2 rounded-md pr-2 text-left',
        einzug === 'tief' ? 'pl-11' : 'pl-[26px]',
        gewaehlt ? 'bg-orange-50 dark:bg-orange-500/10' : 'hover:bg-accent',
      )}
    >
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{zeilenDatum(zeile.beginn, jahr)}</span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[11px] font-medium text-foreground/80">
        {QUELLE_KURZ[zeile.quelle ?? 'unbekannt']}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]" title={zeile.titel}>
        {zeile.titel}
      </span>
      <StandZeichenReihe zeile={zeile} />
    </button>
  )
}
