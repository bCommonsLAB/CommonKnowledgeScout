'use client'

/**
 * @fileoverview Gruppierte Liste der Sitzungen (Register, Welle R3).
 *
 * @description
 * Figma „Gruppenkopf", „Vorhabenkopf" und „N weitere anzeigen": Gruppen sind
 * zugeklappt und tragen ihre Zahl; je Gruppe erscheinen erst fuenf Zeilen.
 * Leere Gruppen (nur „Auffällig") bleiben blass sichtbar. Die Gruppe der
 * gewaehlten Zeile klappt von selbst auf. Was gruppiert wird, rechnet
 * `reiter-gruppen.ts`; hier nur Auf/Zu.
 *
 * @module components/library/agent-view/sitzungen
 */

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReiterGruppe } from '@/lib/agent-view/sitzungen-register/reiter-gruppen'
import { SitzungZeile } from './sitzung-zeile'

const ERSTE_ZEILEN = 5

interface ListenArgs {
  auswahl: string | null
  jahr: number
  onWaehlen: (registerId: string) => void
}

function enthaelt(g: ReiterGruppe, registerId: string): boolean {
  return g.zeilen.some((z) => z.registerId === registerId) || g.untergruppen.some((u) => enthaelt(u, registerId))
}

function Zeilen({ gruppe, einzug, offen, onMehr, ...args }: ListenArgs & {
  gruppe: ReiterGruppe
  einzug: 'tief' | 'flach'
  offen: boolean
  onMehr: () => void
}) {
  const sichtbar = offen ? gruppe.zeilen : gruppe.zeilen.slice(0, ERSTE_ZEILEN)
  const rest = gruppe.zeilen.length - sichtbar.length
  return (
    <>
      {sichtbar.map((z) => (
        <SitzungZeile key={z.registerId} zeile={z} gewaehlt={z.registerId === args.auswahl} einzug={einzug} jahr={args.jahr} onWaehlen={args.onWaehlen} />
      ))}
      {(rest > 0 || (offen && gruppe.zeilen.length > ERSTE_ZEILEN)) && (
        <button
          type="button"
          onClick={onMehr}
          className={cn('py-1.5 pr-2 text-left text-xs font-medium text-orange-700 hover:underline dark:text-orange-400', einzug === 'tief' ? 'pl-11' : 'pl-[26px]')}
        >
          {rest > 0 ? `${rest} weitere anzeigen` : 'weniger anzeigen'}
        </button>
      )}
    </>
  )
}

function Kopf({ gruppe, offen, ebene, onToggle }: { gruppe: ReiterGruppe; offen: boolean; ebene: 1 | 2; onToggle: () => void }) {
  const leer = gruppe.anzahl === 0
  const Pfeil = offen ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={leer}
      aria-expanded={offen}
      className={cn(
        'flex w-full shrink-0 items-center justify-between rounded-md pr-2 text-left hover:bg-accent disabled:hover:bg-transparent',
        ebene === 1 ? 'h-8 pl-1.5' : 'h-[30px] pl-6',
        leer && 'opacity-45',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Pfeil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span
          className={cn('truncate', ebene === 1 ? 'text-xs font-semibold uppercase tracking-[0.02em] text-muted-foreground' : 'text-[13px] font-medium')}
          title={gruppe.name}
        >
          {gruppe.name}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {ebene === 2 && gruppe.vorgeschlagen > 0 && (
          <span className="text-[11px] text-muted-foreground" title="Ort nur vorgeschlagen, noch von keinem Sichten-Lauf bestimmt">
            {gruppe.vorgeschlagen === gruppe.anzahl ? 'Vorschlag' : `davon ${gruppe.vorgeschlagen} Vorschlag`}
          </span>
        )}
        {ebene === 1 ? (
          <span className="rounded-full bg-muted px-[7px] py-0.5 text-[11px] font-semibold">{gruppe.anzahl}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{gruppe.anzahl}</span>
        )}
      </span>
    </button>
  )
}

export function SitzungenGruppen({ gruppen, ...args }: ListenArgs & { gruppen: ReiterGruppe[] }) {
  const [offen, setOffen] = useState<ReadonlySet<string>>(new Set())
  const [alle, setAlle] = useState<ReadonlySet<string>>(new Set())
  const umschalten = (setter: typeof setOffen, key: string) =>
    setter((alt) => { const neu = new Set(alt); if (neu.has(key)) neu.delete(key); else neu.add(key); return neu })

  // Die Gruppe der gewaehlten Zeile (auch nach Deep-Link) klappt auf.
  useEffect(() => {
    if (args.auswahl === null) return
    const auswahl = args.auswahl
    const pfad = gruppen.filter((g) => enthaelt(g, auswahl)).flatMap((g) => [g.schluessel, ...g.untergruppen.filter((u) => enthaelt(u, auswahl)).map((u) => u.schluessel)])
    if (pfad.length > 0) setOffen((alt) => new Set([...alt, ...pfad]))
  }, [args.auswahl, gruppen])

  if (gruppen.length === 0) return <p className="px-2 py-6 text-sm text-muted-foreground">Keine Sitzung passt zu Sicht, Suche und Filtern.</p>
  return (
    <div className="flex flex-col gap-px">
      {gruppen.map((g) => (
        <div key={g.schluessel} className="flex flex-col gap-px">
          <Kopf gruppe={g} offen={offen.has(g.schluessel)} ebene={1} onToggle={() => umschalten(setOffen, g.schluessel)} />
          {offen.has(g.schluessel) && (
            <>
              {g.untergruppen.map((u) => (
                <div key={u.schluessel} className="flex flex-col gap-px">
                  <Kopf gruppe={u} offen={offen.has(u.schluessel)} ebene={2} onToggle={() => umschalten(setOffen, u.schluessel)} />
                  {offen.has(u.schluessel) && (
                    <Zeilen gruppe={u} einzug="tief" offen={alle.has(u.schluessel)} onMehr={() => umschalten(setAlle, u.schluessel)} {...args} />
                  )}
                </div>
              ))}
              <Zeilen gruppe={g} einzug="flach" offen={alle.has(g.schluessel)} onMehr={() => umschalten(setAlle, g.schluessel)} {...args} />
            </>
          )}
        </div>
      ))}
    </div>
  )
}
