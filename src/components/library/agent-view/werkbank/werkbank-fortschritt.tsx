'use client'

/**
 * @fileoverview Fortschrittskopf der aktiven Arbeitsliste (F7, Welle W6).
 *
 * @description
 * „n von m abgenommen · k bereit zur Abnahme · offene Befunde M/C/K" plus
 * segmentierter Balken (fertig → bereit → offen) — REIN clientseitig aus dem
 * Report gerechnet (`worklist-fortschritt.ts`), keine Server-Aggregation.
 *
 * @module components/library/agent-view
 */

import type { WorklistFortschritt } from '@/lib/agent-view/worklist-fortschritt'

export function WerkbankFortschritt({ fortschritt }: { fortschritt: WorklistFortschritt }) {
  const { gesamt, fertig, bereit, offen, offeneBefunde } = fortschritt
  if (gesamt === 0) return null
  const anteil = (wert: number) => `${(wert / gesamt) * 100}%`

  return (
    <div className="space-y-1 border-b px-2 py-1.5">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{fertig} von {gesamt} abgenommen</span>
        {' · '}{bereit} bereit zur Abnahme{' · '}offene Befunde M {offeneBefunde.mensch} · C {offeneBefunde.cowork} · K {offeneBefunde.knowledgescout}
      </p>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${fertig} abgenommen, ${bereit} bereit, ${offen} offen`}
      >
        {fertig > 0 && <div className="bg-emerald-600" style={{ width: anteil(fertig) }} />}
        {bereit > 0 && <div className="bg-amber-500" style={{ width: anteil(bereit) }} />}
      </div>
    </div>
  )
}
