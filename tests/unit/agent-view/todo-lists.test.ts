import { describe, it, expect } from 'vitest'
import { createGap } from '@/lib/agent-view/gap-registry'
import { buildTodoLists } from '@/lib/agent-view/todo-lists'
import type { CoverageGapType } from '@/lib/agent-view/types'

function gap(type: CoverageGapType, path: string) {
  return createGap({ type, scope: 'folder', targetId: path, targetName: path, folderId: 'f', path, message: 'x' })
}

describe('todo-lists', () => {
  it('verteilt Befunde auf die drei Akteur-Listen (Todo-Routing F2)', () => {
    const lists = buildTodoLists([
      gap('twin_unverified', 'a'),
      gap('report_missing', 'b'),
      gap('verweis_tot', 'b'),
      gap('source_without_twin', 'c'),
    ])
    expect(lists.mensch.totalCount).toBe(1)
    expect(lists.cowork.totalCount).toBe(2)
    expect(lists.knowledgescout.totalCount).toBe(1)
  })

  it('gruppiert je Akteur aufsteigend nach Zyklus-Schritt', () => {
    const lists = buildTodoLists([
      gap('verweis_tot', 'a'),      // cowork, Schritt 3
      gap('index_missing', 'b'),    // cowork, Schritt 2
      gap('report_missing', 'c'),   // cowork, Schritt 3
    ])
    expect(lists.cowork.groups.map((g) => g.zyklusSchritt)).toEqual([2, 3])
    expect(lists.cowork.groups[1].gaps.map((g) => g.type)).toEqual(['verweis_tot', 'report_missing'])
  })

  it('liefert fuer leere Reports drei leere Listen (Negativfall)', () => {
    const lists = buildTodoLists([])
    expect(lists.mensch.groups).toEqual([])
    expect(lists.cowork.totalCount).toBe(0)
    expect(lists.knowledgescout.totalCount).toBe(0)
  })
})
