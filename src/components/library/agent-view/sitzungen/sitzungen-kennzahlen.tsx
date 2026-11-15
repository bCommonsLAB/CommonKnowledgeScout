'use client'

/**
 * @fileoverview Rechte Seite ohne Auswahl: Kennzahlen des Registers (Register, Welle R3).
 *
 * @description
 * Figma „1 · Offen", rechts: vier Kennzahlen aus der Bilanz des Servers.
 * „Notiz da, Bericht fehlt" ist hervorgehoben, solange es solche Zeilen gibt.
 * Darunter das Register nach Werkzeug — gezaehlt wird alles, auch Zeilen ohne
 * erkennbares Werkzeug.
 *
 * @module components/library/agent-view/sitzungen
 */

import { cn } from '@/lib/utils'
import type { SitzungsBilanz } from '@/lib/agent-view/sitzungen-register/filter'

function Kennzahl({ zahl, text, betont = false }: { zahl: number; text: string; betont?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-[90px] min-w-0 flex-col gap-1.5 rounded-[10px] border p-3.5',
        betont ? 'border-orange-300 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-500/10' : 'bg-card',
      )}
    >
      <span className={cn('text-2xl font-semibold', betont && 'text-orange-700 dark:text-orange-400')}>{zahl}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  )
}

export function registerZeile(b: SitzungsBilanz): string {
  const teile = [
    `Register: ${b.gesamt} Sitzungen`,
    `Code ${b.jeQuelle.code_lokal + b.jeQuelle.code_cloud}`,
    `Cowork ${b.jeQuelle.cowork}`,
    `Chat ${b.jeQuelle.chat}`,
  ]
  if (b.jeQuelle.unbekannt > 0) teile.push(`Werkzeug unbekannt ${b.jeQuelle.unbekannt}`)
  if (b.jeStand.uebersprungen > 0) teile.push(`übersprungen ${b.jeStand.uebersprungen}`)
  return teile.join(' · ')
}

export function SitzungenKennzahlen({ bilanz, hinweis }: { bilanz: SitzungsBilanz; hinweis: string | null }) {
  return (
    <div className="@container flex h-full flex-col gap-4 overflow-auto px-7 py-6">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold">Sitzung links wählen</p>
        <p className="text-[13px] text-muted-foreground">Beleg, Notiz, Bericht und Hinweise erscheinen hier.</p>
      </div>
      {hinweis !== null && <p className="text-[13px] text-orange-700 dark:text-orange-400">{hinweis}</p>}
      <div className="grid max-w-[702px] grid-cols-2 gap-2.5 @[560px]:grid-cols-4">
        <Kennzahl zahl={bilanz.jeStand.notiz} text="Notiz da, Bericht fehlt" betont={bilanz.jeStand.notiz > 0} />
        <Kennzahl zahl={bilanz.jeStand.berichtet} text="berichtet" />
        <Kennzahl zahl={bilanz.jeStand.gemeldet} text="gemeldet, Beleg fehlt" />
        <Kennzahl zahl={bilanz.auffaellig.beleg_ohne_vorhaben} text="Beleg ohne Vorhaben" />
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <p className="text-muted-foreground">{registerZeile(bilanz)}</p>
        <p className="text-muted-foreground/70">Der Stand wird aus Beleg und Notiz gerechnet, nie abgehakt.</p>
      </div>
    </div>
  )
}
