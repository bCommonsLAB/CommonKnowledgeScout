'use client'

/**
 * @fileoverview Hauptanzeige der Agentensicht: Wessen Arbeit, welcher Schritt?
 *
 * @description
 * Pilot-Wunschliste D1: Die Gesamtzahl der Befunde misst keinen Fortschritt —
 * Befunde WANDERN (Mensch → Pipeline → Verifikation). Hauptanzeige sind
 * darum die Aufschluesselung nach Akteur und Zyklus-Schritt, das Delta seit
 * dem letzten Scan und der Zustand „bereit zur Abnahme" (D2: null
 * maschinelle Befunde, alles wartet auf den Menschen).
 *
 * @module components/library/agent-view
 */

import { Badge } from '@/components/ui/badge'
import { actorLabel, zyklusSchrittLabel } from '@/lib/agent-view/labels'
import type { CoverageDelta } from '@/lib/agent-view/coverage-delta'
import type { CoverageReport, GapActor, ZyklusSchritt } from '@/lib/agent-view/types'

const ACTOR_ORDER: GapActor[] = ['mensch', 'cowork', 'knowledgescout']
const ACTOR_STYLE: Record<GapActor, string> = {
  mensch: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  cowork: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  knowledgescout: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200',
}

function countBySchritt(report: CoverageReport): Map<ZyklusSchritt, number> {
  const counts = new Map<ZyklusSchritt, number>()
  for (const gap of report.gaps) counts.set(gap.zyklusSchritt, (counts.get(gap.zyklusSchritt) ?? 0) + 1)
  return counts
}

export function CoverageProgress({
  report,
  delta,
  deltaHinweis,
}: {
  report: CoverageReport
  delta: CoverageDelta | null
  deltaHinweis: string | null
}) {
  const byActor = report.totals.gapsByActor
  const maschinell = byActor.cowork + byActor.knowledgescout
  const bereitZurAbnahme = maschinell === 0 && byActor.mensch > 0
  const bySchritt = countBySchritt(report)

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Wessen Arbeit?
        </span>
        {ACTOR_ORDER.map((actor) => (
          <span
            key={actor}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTOR_STYLE[actor]}`}
            title={`Offene Befunde fuer ${actorLabel(actor)}`}
          >
            {actorLabel(actor)} {byActor[actor]}
          </span>
        ))}
        {bereitZurAbnahme && (
          <Badge
            className="bg-emerald-600 text-white hover:bg-emerald-600"
            title="Null maschinelle Befunde — alles wartet auf Verifikation/Abnahme (F4). Gruen kann nur der Mensch machen."
          >
            bereit zur Abnahme
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {[1, 2, 3, 4].map((schritt) => (
          <span key={schritt} title={zyklusSchrittLabel(schritt as ZyklusSchritt)}>
            {zyklusSchrittLabel(schritt as ZyklusSchritt).replace(/^Schritt (\d) — /, '$1 · ')}:{' '}
            {bySchritt.get(schritt as ZyklusSchritt) ?? 0}
          </span>
        ))}
        <span className="ml-auto" title="Seit dem letzten Scan gleichen Scopes — Befunde wandern, die Gesamtzahl misst nichts.">
          {delta
            ? `seit letztem Scan: ${delta.erledigt} erledigt · ${delta.neu} neu`
            : deltaHinweis ?? 'kein Delta'}
        </span>
      </div>
    </div>
  )
}
