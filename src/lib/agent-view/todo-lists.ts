/**
 * @fileoverview Todo-Listen nach Akteur (Welle 3, Projektauftrag F2/F3).
 *
 * @description
 * Aus den Befunden eines Coverage-Reports entstehen drei Listen — Mensch,
 * Cowork, KnowledgeScout — gruppiert nach dem Zyklus-Schritt, auf den der
 * Gap-Typ routet (Registry). Cowork-Todos speist der Auftrags-Generator;
 * KnowledgeScout-Todos verweisen auf die vorhandenen Werkzeuge
 * (Pruefen/Reparieren, Pipeline); Mensch-Todos sind die Abnahme-Liste.
 *
 * Reine Funktionen, kein I/O; Reihenfolge deterministisch.
 *
 * @module agent-view
 */

import type { CoverageGap, GapActor, ZyklusSchritt } from './types'

export interface TodoGroup {
  zyklusSchritt: ZyklusSchritt
  gaps: CoverageGap[]
}

export interface TodoList {
  actor: GapActor
  totalCount: number
  /** Gruppen aufsteigend nach Zyklus-Schritt; leere Schritte fehlen. */
  groups: TodoGroup[]
}

export const TODO_ACTORS: readonly GapActor[] = ['mensch', 'cowork', 'knowledgescout']

/**
 * Baut die drei Todo-Listen aus den Report-Befunden. Die Befunde behalten
 * ihre Report-Reihenfolge (bereits deterministisch sortiert).
 */
export function buildTodoLists(gaps: readonly CoverageGap[]): Record<GapActor, TodoList> {
  const byActor = new Map<GapActor, Map<ZyklusSchritt, CoverageGap[]>>(
    TODO_ACTORS.map((actor) => [actor, new Map()]),
  )
  for (const gap of gaps) {
    const groups = byActor.get(gap.actor)
    if (!groups) throw new Error(`Befund mit unbekanntem Akteur: ${String(gap.actor)}`)
    const bucket = groups.get(gap.zyklusSchritt)
    if (bucket) bucket.push(gap)
    else groups.set(gap.zyklusSchritt, [gap])
  }

  const result = {} as Record<GapActor, TodoList>
  for (const actor of TODO_ACTORS) {
    const groups = [...(byActor.get(actor) ?? new Map<ZyklusSchritt, CoverageGap[]>()).entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([zyklusSchritt, actorGaps]) => ({ zyklusSchritt, gaps: actorGaps }))
    result[actor] = {
      actor,
      totalCount: groups.reduce((sum, group) => sum + group.gaps.length, 0),
      groups,
    }
  }
  return result
}
