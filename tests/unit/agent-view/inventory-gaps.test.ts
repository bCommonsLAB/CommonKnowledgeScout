import { describe, it, expect } from 'vitest'
import { orphanTwinDocuments, orphanTwinFolders } from '@/lib/agent-view/inventory-gaps'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { TwinFamilyView } from '@/lib/agent-view/twin-rules'

function folder(twinSourcePresent: boolean): ArchiveFolderNode {
  return {
    folderId: 'f1',
    name: '25.01 Pilot',
    path: '25.01 Pilot',
    parentFolderId: 'root',
    depth: 1,
    files: [],
    twinFolders: [
      {
        folderId: 't1',
        name: '_Aufnahme.m4a',
        path: '25.01 Pilot/_Aufnahme.m4a',
        expectedSourceName: 'Aufnahme.m4a',
        sourcePresent: twinSourcePresent,
        artifactNames: ['Aufnahme.md'],
      },
    ],
    index: null,
    bericht: null,
    bearbeitungsstand: null,
    bearbeitungsstandSeit: null,
  }
}

const family: TwinFamilyView = {
  sourceId: 's1',
  sourceName: 'Aufnahme.m4a',
  folderId: 'f1',
  path: '25.01 Pilot/Aufnahme.m4a',
  artifacts: [{ kind: 'transcript', targetLanguage: '', updatedAt: '2026-08-01T10:00:00.000Z', frontmatter: {} }],
}

describe('inventory-gaps — orphan_twin', () => {
  it('meldet einen Spiegelordner ohne Quelldatei (Positivfall)', () => {
    const gaps = orphanTwinFolders([folder(false)])
    expect(gaps.map((g) => g.type)).toEqual(['orphan_twin'])
    expect(gaps[0].detail).toContain('Aufnahme.md')
  })

  it('meldet nichts, wenn die Quelle daneben liegt (Negativfall)', () => {
    expect(orphanTwinFolders([folder(true)])).toEqual([])
  })

  it('meldet ein Twin-Dokument ohne Scan-Fund (Positivfall)', () => {
    const gaps = orphanTwinDocuments({ families: [family], scannedFileIds: new Set(), rootFolderId: 'root' })
    expect(gaps.map((g) => g.type)).toEqual(['orphan_twin'])
  })

  it('meldet nichts, wenn die Quelle gescannt wurde (Negativfall)', () => {
    expect(orphanTwinDocuments({ families: [family], scannedFileIds: new Set(['s1']), rootFolderId: 'root' })).toEqual([])
  })

  it('meldet nichts fuer ein Twin-Dokument ganz ohne Artefakte', () => {
    const leer = { ...family, artifacts: [] }
    expect(orphanTwinDocuments({ families: [leer], scannedFileIds: new Set(), rootFolderId: 'root' })).toEqual([])
  })
})
