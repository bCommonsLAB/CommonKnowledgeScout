'use client'

/**
 * @fileoverview Vier Schritte nebeneinander — wo steht dieses Vorhaben?
 *
 * @description
 * Rueckfrage aus dem Live-Test (27.08.2026): „Was mache ich in Cowork, was
 * hier? Es sind mehrere Schritte — ich will sehen, wo ich stehe." Die Leiste
 * zeigt den Erschliessungszyklus als vier Punkte nebeneinander, je mit
 * Zustaendigem, offenen Punkten und der Marke, wo die Arbeit gerade liegt.
 *
 * Zwei Aussagen bleiben getrennt sichtbar, weil sie verschiedene Dinge sind:
 * die MESSUNG (offene Befunde je Schritt) und die SELBSTAUSKUNFT (der
 * erklaerte Bearbeitungsstand). Fallen sie auseinander, ist das kein Fehler
 * der Anzeige, sondern der Befund „Stand passt nicht zum Inhalt".
 *
 * @module components/library/agent-view
 */

import { zyklusSchrittLabel } from '@/lib/agent-view/labels'
import type { Bearbeitungsstand, GapCountByType } from '@/lib/agent-view/types'
import {
  SCHRITT_WERKZEUG,
  SCHRITT_ZUSTAENDIG,
  berechneZyklusFortschritt,
  type SchrittLage,
} from '@/lib/agent-view/zyklus-fortschritt'

/** Kurzname ohne „Schritt n — " Praefix, fuer die enge Zeile. */
function kurzName(lage: SchrittLage): string {
  return zyklusSchrittLabel(lage.schritt).split('—')[1]?.trim() ?? String(lage.schritt)
}

function SchrittPunkt({ lage }: { lage: SchrittLage }) {
  const frei = lage.offen === 0
  const ton = lage.istDran
    ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : frei
      ? 'border-emerald-300/60 text-emerald-700 dark:text-emerald-400'
      : 'border-border text-muted-foreground'
  const zeichen = frei ? '✓' : lage.istDran ? '▶' : '·'
  const titel =
    `${zyklusSchrittLabel(lage.schritt)} · ${SCHRITT_ZUSTAENDIG[lage.schritt]} · ${SCHRITT_WERKZEUG[lage.schritt]}\n` +
    (frei ? 'Keine offenen Punkte.' : `${lage.offen} offene(r) Punkt(e).`) +
    (lage.behauptetErledigt ? '\nDein erklaerter Stand sagt: erledigt.' : '')
  return (
    <li className={`flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 ${ton}`} title={titel}>
      <span aria-hidden>{zeichen}</span>
      <span className="truncate font-medium">{kurzName(lage)}</span>
      <span className="opacity-70">({SCHRITT_ZUSTAENDIG[lage.schritt]})</span>
      {lage.offen > 0 && <span className="tabular-nums">{lage.offen}</span>}
    </li>
  )
}

export function ZyklusLeiste({ gapsByType, bearbeitungsstand, markierungen }: {
  gapsByType: GapCountByType
  bearbeitungsstand: Bearbeitungsstand | null
  /** Frische Fehler-Markierungen aus den effektiven Familien. */
  markierungen: number
}) {
  const fortschritt = berechneZyklusFortschritt({ gapsByType, bearbeitungsstand, markierungen })
  const dran = fortschritt.schritte.find((lage) => lage.istDran)

  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap items-center gap-1 text-[11px]">
        {fortschritt.schritte.map((lage) => (
          <SchrittPunkt key={lage.schritt} lage={lage} />
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        {dran === undefined ? (
          <>Alle vier Schritte sind frei — es fehlt nur noch deine Abnahme.</>
        ) : (
          <>
            Dran ist <span className="font-medium text-foreground">{zyklusSchrittLabel(dran.schritt)}</span> —
            {' '}{SCHRITT_ZUSTAENDIG[dran.schritt] === 'du' ? 'das machst du ' : `zustaendig ist ${SCHRITT_ZUSTAENDIG[dran.schritt]}, `}
            {SCHRITT_WERKZEUG[dran.schritt]}.
          </>
        )}
      </p>
    </div>
  )
}
