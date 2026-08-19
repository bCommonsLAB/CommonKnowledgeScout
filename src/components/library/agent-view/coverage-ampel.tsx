'use client'

/**
 * @fileoverview Vertrauensampel und Befund-Abzeichen der Agentensicht.
 *
 * @description
 * Gruen ist ein Knoten erst, wenn der GESAMTE Teilbaum ohne blockierenden
 * Befund ist (Akzeptanzkriterium 7) — die Farbe kommt fertig aus dem Report,
 * die UI rechnet nichts nach.
 *
 * @module components/library/agent-view
 */

import { Badge } from '@/components/ui/badge'
import { actorSummary, gapCountLabel } from '@/lib/agent-view/labels'
import type { CoverageTreeNode, GapActor } from '@/lib/agent-view/types'

const AMPEL_CLASS: Record<CoverageTreeNode['ampel'], string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-amber-500',
  rot: 'bg-red-500',
}

const AMPEL_TITLE: Record<CoverageTreeNode['ampel'], string> = {
  gruen: 'Kein Befund im Teilbaum',
  gelb: 'Nur informative Befunde im Teilbaum',
  rot: 'Offene Befunde im Teilbaum',
}

export function CoverageAmpel({ ampel }: { ampel: CoverageTreeNode['ampel'] }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${AMPEL_CLASS[ampel]}`}
      title={AMPEL_TITLE[ampel]}
      aria-label={AMPEL_TITLE[ampel]}
    />
  )
}

export function GapCountBadge({ count, byActor }: { count: number; byActor: Record<GapActor, number> }) {
  if (count <= 0) return null
  return (
    <Badge variant="secondary" title={actorSummary(byActor)}>
      {gapCountLabel(count)}
    </Badge>
  )
}
