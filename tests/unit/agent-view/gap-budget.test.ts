import { describe, it, expect } from 'vitest'
import { applyGapBudget, collapseRootByFolder } from '@/lib/agent-view/gap-budget'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { Bearbeitungsstand, CoverageGapType } from '@/lib/agent-view/types'

function folder(id: string, path: string, parent: string | null, depth: number, stand: Bearbeitungsstand | null = null): ArchiveFolderNode {
  return {
    folderId: id,
    name: path.split('/').pop() ?? '',
    path,
    parentFolderId: parent,
    depth,
    files: [],
    twinFolders: [],
    index: null,
    bericht: null,
    bearbeitungsstand: stand,
    bearbeitungsstandSeit: null,
  }
}

function gap(type: CoverageGapType, folderId: string) {
  return createGap({ type, scope: 'folder', targetId: folderId, targetName: folderId, folderId, path: folderId, message: 'x' })
}

const FOLDERS = [
  folder('root', '', null, 0),
  folder('alt', 'Alt', 'root', 1, 'ungesichtet'),
  folder('alt-2024', 'Alt/2024', 'alt', 2),
  folder('pilot', 'Pilot', 'root', 1, 'abgenommen'),
]

describe('gap-budget', () => {
  it('ordnet jeden Ordner dem aeussersten ungesichteten Vorfahren zu', () => {
    const map = collapseRootByFolder(FOLDERS)
    expect(map.get('alt')).toBe('alt')
    expect(map.get('alt-2024')).toBe('alt')
    expect(map.has('pilot')).toBe(false)
  })

  it('fasst Befunde unter ungesichteten Ordnern zu EINEM Sammel-Gap zusammen', () => {
    const result = applyGapBudget(FOLDERS, [
      gap('source_without_twin', 'alt'),
      gap('source_without_twin', 'alt-2024'),
      gap('twin_flagged', 'alt-2024'),
      gap('report_missing', 'pilot'),
    ])
    expect(result.collapsed).toBe(3)
    const types = result.gaps.map((g) => g.type).sort()
    expect(types).toEqual(['report_missing', 'teilbaum_ungesichtet'])
    const sammel = result.gaps.find((g) => g.type === 'teilbaum_ungesichtet')
    expect(sammel?.message).toContain('3')
    expect(sammel?.folderId).toBe('alt')
  })

  it('fasst scan_error NIE zusammen (Betriebszustand bleibt sichtbar)', () => {
    const result = applyGapBudget(FOLDERS, [gap('scan_error', 'alt-2024')])
    expect(result.gaps.map((g) => g.type)).toEqual(['scan_error'])
    expect(result.collapsed).toBe(0)
  })

  it('laesst alles unveraendert, wenn kein Ordner ungesichtet ist (Negativfall)', () => {
    const ohneUngesichtet = FOLDERS.filter((f) => f.bearbeitungsstand !== 'ungesichtet')
    const gaps = [gap('report_missing', 'pilot')]
    const result = applyGapBudget(ohneUngesichtet, gaps)
    expect(result.collapsed).toBe(0)
    expect(result.gaps).toEqual(gaps)
  })
})
