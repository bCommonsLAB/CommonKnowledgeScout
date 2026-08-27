/**
 * @fileoverview Unit-Tests: akteur-basierte Ampel des Agenten-Baums (24.08.2026).
 *
 * Beschluss nach Peters Live-Test (alle 148 Vorhaben rot, keine
 * Differenzierung): rot = maschinelle Befunde (Cowork/KnowledgeScout) offen —
 * bewusst unabhaengig von der Severity, auch `info`; gelb = das geteilte
 * Praedikat „bereit zur Abnahme" (nur Mensch-Befunde); gruen = kein Befund im
 * GESAMTEN Teilbaum (Akzeptanzkriterium 7 unveraendert). Aggregation: die
 * Ampel eines Ordners urteilt ueber den Teilbaum, nicht nur eigene Befunde.
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { createGap } from '@/lib/agent-view/gap-registry'
import { buildTree } from '@/lib/agent-view/tree-builder'
import type { CoverageGap } from '@/lib/agent-view/types'

function folder(path: string, parent: string | null): ArchiveFolderNode {
  return {
    folderId: `f-${path || 'root'}`,
    name: path.split('/').pop() ?? '',
    path,
    parentFolderId: parent,
    depth: path === '' ? 0 : path.split('/').length,
    files: [],
    twinFolders: [],
    index: null,
    bericht: null,
    bearbeitungsstand: null,
    bearbeitungsstandSeit: null,
  }
}

function gapAt(folderId: string, type: CoverageGap['type']): CoverageGap {
  return createGap({
    type, scope: 'folder', targetId: folderId, targetName: folderId,
    folderId, path: folderId, message: 'Test',
  })
}

function baue(gaps: CoverageGap[]) {
  const folders = [folder('', null), folder('A', 'f-root'), folder('A/Tief', 'f-A'), folder('B', 'f-root')]
  const roots = buildTree({ folders, gaps, sourceCountByFolder: new Map(), ownChangeByFolder: new Map() })
  const flach = new Map<string, (typeof roots)[number]>()
  const walk = (nodes: typeof roots) => nodes.forEach((n) => { flach.set(n.folderId, n); walk(n.children) })
  walk(roots)
  return flach
}

describe('buildTree — akteur-basierte Ampel', () => {
  it('rot bei maschinellen Befunden — auch bei Severity info (transformation_stale)', () => {
    // source_without_twin: knowledgescout/error · transformation_stale: knowledgescout/INFO.
    expect(baue([gapAt('f-A', 'source_without_twin')]).get('f-A')?.ampel).toBe('rot')
    expect(baue([gapAt('f-A', 'transformation_stale')]).get('f-A')?.ampel).toBe('rot')
    expect(baue([gapAt('f-A', 'report_missing')]).get('f-A')?.ampel).toBe('rot') // cowork
  })

  it('gelb, wenn nur nicht-sperrende Mensch-Befunde offen sind', () => {
    const flach = baue([gapAt('f-A', 'stand_widerspruch')]) // mensch, kein Widerstand
    expect(flach.get('f-A')?.ampel).toBe('gelb')
    // Mensch + Maschine gemischt → die Maschine gewinnt: rot.
    expect(baue([gapAt('f-A', 'stand_widerspruch'), gapAt('f-A', 'report_missing')]).get('f-A')?.ampel).toBe('rot')
  })

  it('rot, sobald der Mensch etwas als fehlerhaft markiert hat (ADR 0006)', () => {
    // Der einzige Mensch-Befund, der sperrt — er faerbt wie ein Maschinen-Befund.
    expect(baue([gapAt('f-A', 'twin_flagged')]).get('f-A')?.ampel).toBe('rot')
  })

  it('gruen nur ohne Befund im Teilbaum (Akzeptanzkriterium 7 unveraendert)', () => {
    const flach = baue([])
    expect(flach.get('f-A')?.ampel).toBe('gruen')
    expect(flach.get('f-root')?.ampel).toBe('gruen')
  })

  it('aggregiert ueber den Teilbaum: ein maschineller Befund tief unten macht die Eltern rot, Geschwister nicht', () => {
    const flach = baue([gapAt('f-A/Tief', 'source_without_twin')])
    expect(flach.get('f-A/Tief')?.ampel).toBe('rot')
    expect(flach.get('f-A')?.ampel).toBe('rot')
    expect(flach.get('f-root')?.ampel).toBe('rot')
    expect(flach.get('f-B')?.ampel).toBe('gruen')
  })

  it('Mensch-Befund im Kind macht die Eltern gelb, solange keine Maschine offen ist', () => {
    const flach = baue([gapAt('f-A/Tief', 'stand_widerspruch')])
    expect(flach.get('f-A')?.ampel).toBe('gelb')
    expect(flach.get('f-root')?.ampel).toBe('gelb')
  })
})

describe('buildTree — W8-Merge-Skalare', () => {
  it('schreibt eigene Aenderung und Bericht-Skalare in jeden Knoten (Merge-Grundlage)', () => {
    const folders = [folder('', null), folder('A', 'f-root')]
    folders[1].bericht = {
      fileId: 'ber-A', name: 'BERICHT.md', path: 'A/BERICHT.md',
      modifiedAt: '2026-08-20T10:00:00.000Z', meta: {}, body: '# A',
    }
    const roots = buildTree({
      folders, gaps: [], sourceCountByFolder: new Map(),
      ownChangeByFolder: new Map([['f-A', '2026-08-21T09:00:00.000Z']]),
    })
    const a = roots[0].children[0]
    expect(a.neuesteEigeneAenderung).toBe('2026-08-21T09:00:00.000Z')
    expect(a.berichtFileId).toBe('ber-A')
    expect(a.berichtModifiedAt).toBe('2026-08-20T10:00:00.000Z')
    // Ohne Eintrag/Bericht: explizit null, kein undefined-Raten.
    expect(roots[0].neuesteEigeneAenderung).toBeNull()
    expect(roots[0].berichtFileId).toBeNull()
  })
})
