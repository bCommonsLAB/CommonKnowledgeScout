'use client'

/**
 * @fileoverview Kopf der Sitzungs-Liste: Sicht, Gruppierung, Sortierung (Register, Welle R3).
 *
 * @description
 * Figma „Umschalter" (Offen | Auffällig | Alle mit Zahlen; die gewaehlte Sicht
 * orange) und „Gruppieren und Sortierung" (die gewaehlte Gruppierung dunkel).
 * Welche Gruppierungen eine Sicht kennt, sagt `GRUPPIERUNGEN_JE_SICHT`.
 *
 * @module components/library/agent-view/sitzungen
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ks/ui'
import { cn } from '@/lib/utils'
import { GRUPPIERUNGEN_JE_SICHT } from '@/hooks/agent-view/use-sitzungen-url-state'
import type { ReiterGruppierung } from '@/lib/agent-view/sitzungen-register/reiter-gruppen'
import {
  REITER_SICHTEN, REITER_SORTIERUNGEN, type ReiterSicht, type ReiterSortierung,
} from '@/lib/agent-view/sitzungen-register/reiter-sicht'

const SICHT_NAMEN: Readonly<Record<ReiterSicht, string>> = { offen: 'Offen', auffaellig: 'Auffällig', alle: 'Alle' }
const GRUPPIERUNG_NAMEN: Readonly<Record<ReiterGruppierung, string>> = { bereich: 'Bereich', werkzeug: 'Werkzeug', hinweis: 'Hinweis' }
const SORTIERUNG_NAMEN: Readonly<Record<ReiterSortierung, string>> = { neueste: 'Datum', aelteste: 'Älteste zuerst', titel: 'Titel' }

export function SitzungenUmschalter(props: {
  sicht: ReiterSicht
  zahlen: Record<ReiterSicht, number>
  onSicht: (s: ReiterSicht) => void
  gruppierung: ReiterGruppierung
  onGruppierung: (g: ReiterGruppierung) => void
  sortierung: ReiterSortierung
  onSortierung: (s: ReiterSortierung) => void
}) {
  return (
    <>
      <div role="tablist" aria-label="Sicht" className="flex w-fit items-center gap-0.5 rounded-lg border p-[3px]">
        {REITER_SICHTEN.map((s) => {
          const aktiv = s === props.sicht
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={aktiv}
              onClick={() => props.onSicht(s)}
              className={cn(
                'flex items-center gap-[5px] rounded-md border px-2.5 py-[5px] text-[13px]',
                aktiv ? 'border-orange-300 bg-orange-50 font-medium text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/10 dark:text-orange-400' : 'border-transparent text-foreground/80 hover:bg-accent',
              )}
            >
              {SICHT_NAMEN[s]}
              <span className={cn('text-[11px] font-semibold', !aktiv && 'text-muted-foreground')}>{props.zahlen[s]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Gruppieren:</span>
          <div className="flex items-center gap-0.5 rounded-lg border p-[3px]">
            {GRUPPIERUNGEN_JE_SICHT[props.sicht].map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={g === props.gruppierung}
                onClick={() => props.onGruppierung(g)}
                className={cn(
                  'rounded-md px-2.5 py-[5px] text-[13px]',
                  g === props.gruppierung ? 'bg-primary font-medium text-primary-foreground' : 'text-foreground/80 hover:bg-accent',
                )}
              >
                {GRUPPIERUNG_NAMEN[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sortierung</span>
          <Select value={props.sortierung} onValueChange={(v) => props.onSortierung(v as ReiterSortierung)}>
            <SelectTrigger className="h-[29px] w-auto gap-1.5 px-2 text-[13px]" aria-label="Sortierung">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REITER_SORTIERUNGEN.map((s) => (
                <SelectItem key={s} value={s}>{SORTIERUNG_NAMEN[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}
