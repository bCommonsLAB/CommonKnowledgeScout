'use client'

/**
 * @fileoverview Suche und Chips der Sitzungs-Liste (Register, Welle R3).
 *
 * @description
 * Figma „Suche" und „Filter Werkzeug": Suche in Titel, Kennung und Branch;
 * Chips Code, Cowork, Chat (mehrere waehlbar, keiner = alle) und Zeitraum
 * (von/bis ueber den Beginn, im Aufklapper). Gewaehlte Chips sind orange.
 *
 * @module components/library/agent-view/sitzungen
 */

import { Search, X } from 'lucide-react'
import { Input, Popover, PopoverContent, PopoverTrigger } from '@ks/ui'
import { cn } from '@/lib/utils'
import { REITER_WERKZEUGE, type ReiterWerkzeug } from '@/lib/agent-view/sitzungen-register/reiter-sicht'

const WERKZEUG_NAMEN: Readonly<Record<ReiterWerkzeug, string>> = { code: 'Code', cowork: 'Cowork', chat: 'Chat' }

function chipKlasse(aktiv: boolean): string {
  return cn(
    'flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-xs',
    aktiv ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/10 dark:text-orange-400' : 'text-foreground/80 hover:bg-accent',
  )
}

/** Ein geleertes Datumsfeld heisst „keine Grenze". */
function leerZuNull(wert: string): string | null {
  return wert === '' ? null : wert
}

function zeitraumName(von: string | null, bis: string | null): string {
  if (von === null && bis === null) return 'Zeitraum'
  return `${von ?? '…'} – ${bis ?? '…'}`
}

export function SitzungenFilter(props: {
  suche: string
  onSuche: (s: string) => void
  werkzeuge: readonly ReiterWerkzeug[]
  onWerkzeuge: (w: ReiterWerkzeug[]) => void
  von: string | null
  bis: string | null
  onZeitraum: (von: string | null, bis: string | null) => void
}) {
  const umschalten = (w: ReiterWerkzeug) =>
    props.onWerkzeuge(props.werkzeuge.includes(w) ? props.werkzeuge.filter((x) => x !== w) : [...props.werkzeuge, w])
  const zeitraumAktiv = props.von !== null || props.bis !== null

  return (
    <>
      <label className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={props.suche}
          onChange={(e) => props.onSuche(e.target.value)}
          placeholder="Suche in Titel, Kennung, Branch …"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          aria-label="Sitzungen durchsuchen"
        />
        {props.suche !== '' && (
          <button type="button" onClick={() => props.onSuche('')} aria-label="Suche leeren">
            <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </button>
        )}
      </label>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter Werkzeug">
        {REITER_WERKZEUGE.map((w) => (
          <button key={w} type="button" aria-pressed={props.werkzeuge.includes(w)} onClick={() => umschalten(w)} className={chipKlasse(props.werkzeuge.includes(w))}>
            {WERKZEUG_NAMEN[w]}
          </button>
        ))}
        <span className="text-[13px] text-border" aria-hidden>|</span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-pressed={zeitraumAktiv} className={chipKlasse(zeitraumAktiv)}>
              {zeitraumName(props.von, props.bis)}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-2 p-3">
            <p className="text-xs text-muted-foreground">Beginn der Sitzung. Zeilen ohne Datum fallen heraus.</p>
            <label className="flex items-center justify-between gap-2 text-xs">
              von
              <Input type="date" value={props.von ?? ''} onChange={(e) => props.onZeitraum(leerZuNull(e.target.value), props.bis)} className="h-8 w-40 text-xs" />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              bis
              <Input type="date" value={props.bis ?? ''} onChange={(e) => props.onZeitraum(props.von, leerZuNull(e.target.value))} className="h-8 w-40 text-xs" />
            </label>
            {zeitraumAktiv && (
              <button type="button" onClick={() => props.onZeitraum(null, null)} className="text-xs text-orange-700 hover:underline dark:text-orange-400">
                Zeitraum entfernen
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
