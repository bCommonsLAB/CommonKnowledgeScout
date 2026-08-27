'use client'

/**
 * @fileoverview Was die Abnahme blockiert — aufklappbar unter dem Kopf.
 *
 * @description
 * Befund aus dem Live-Test (27.08.2026): Der Chip sagte „2 Widerstaende
 * offen", der Baum zeigte lauter Haken — die beiden Befunde hingen am
 * VORHABEN, nicht an einem Artefakt, und waren nur ueber das Menue `⋯`
 * erreichbar. Eine Zahl, die man nicht aufloesen kann, ist eine Sackgasse.
 *
 * Diese Liste nennt beide Arten von Widerstand an EINER Stelle:
 * maschinelle Befunde des Teilbaums (Cowork/KnowledgeScout) und die vom
 * Menschen gesetzten Fehler-Markierungen. Markierungen sind anklickbar —
 * sie fuehren zum Artefakt.
 *
 * @module components/library/agent-view
 */

import { gapLabel } from '@/lib/agent-view/labels'
import type { CoverageGap, TwinFamilySummary } from '@/lib/agent-view/types'
import { artefaktMarkiert, familienPruefstand } from '@/lib/agent-view/werkbank-baum'

/** Markierte Artefakte einer Familie mit ihrer Notiz — fuer die Zeile. */
function markierungenVon(familie: TwinFamilySummary): { teil: string; notiz: string }[] {
  const teile: { teil: string; notiz: string }[] = []
  for (const [teil, artefakt] of [
    ['Transkript', familie.transkript],
    ['Zusammenfassung', familie.zusammenfassung],
  ] as const) {
    if (artefakt != null && artefaktMarkiert(artefakt)) {
      teile.push({ teil, notiz: artefakt.flaggedNote ?? '(ohne Notiz)' })
    }
  }
  return teile
}

export function WiderstandsListe({ befunde, familien, maschinellGesamt, onWaehleArtefakt }: {
  /** Befunde des Teilbaums (via `teilbaumBefunde`) — kann gekappt sein. */
  befunde: readonly CoverageGap[]
  /** Effektive Familien des Vorhabens; undefined = Report vor Welle 4. */
  familien: readonly TwinFamilySummary[] | undefined
  /** Gezaehlte maschinelle Befunde der Karte — mehr als gelistet ⇒ Kappung. */
  maschinellGesamt: number
  onWaehleArtefakt: (sourceId: string) => void
}) {
  const maschinell = befunde.filter((gap) => gap.actor !== 'mensch')
  const fehlend = Math.max(0, maschinellGesamt - maschinell.length)
  const markierte = (familien ?? []).filter((familie) => familienPruefstand(familie) === 'markiert')

  if (maschinell.length === 0 && markierte.length === 0 && fehlend === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nichts sperrt die Abnahme — weder ein maschineller Befund noch eine Fehler-Markierung.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
      {markierte.length > 0 && (
        <div>
          <p className="font-medium">Von dir als fehlerhaft markiert</p>
          <ul className="mt-1 space-y-1">
            {markierte.map((familie) =>
              markierungenVon(familie).map(({ teil, notiz }) => (
                <li key={`${familie.sourceId}-${teil}`}>
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => onWaehleArtefakt(familie.sourceId)}
                  >
                    <span aria-hidden>⊘ </span>
                    {familie.sourceName} · {teil}: {notiz}
                  </button>
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      {fehlend > 0 && (
        <p className="font-medium">
          {fehlend} weitere(r) maschinelle(r) Befund(e) sind gezaehlt, aber nicht im gespeicherten Report
          gelistet (Gap-Budget) — „Neu scannen" holt sie.
        </p>
      )}

      {maschinell.length > 0 && (
        <div>
          <p className="font-medium">Maschinelle Befunde in diesem Vorhaben</p>
          <ul className="mt-1 space-y-1">
            {maschinell.map((gap, idx) => (
              <li key={`${gap.type}-${gap.path}-${idx}`} className="text-muted-foreground">
                <span className="text-foreground">{gapLabel(gap.type)}</span> · {gap.path}
                {gap.message ? ` — ${gap.message}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            Diese erledigt die Maschine (Cowork/KnowledgeScout) — im Menue `⋯` liegt der fertige Auftragstext.
          </p>
        </div>
      )}
    </div>
  )
}
