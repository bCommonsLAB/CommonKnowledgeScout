import { describe, it, expect } from 'vitest'
import { orphanTwinDocuments, orphanTwinFolders, quellenVerschwunden } from '@/lib/agent-view/inventory-gaps'
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
  parentId: 'f1',
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
    const gaps = orphanTwinDocuments({ families: [family], scannedFileIds: new Set(), scannedFolderIds: new Set(), rootFolderId: 'root' })
    expect(gaps.map((g) => g.type)).toEqual(['orphan_twin'])
  })

  it('meldet nichts, wenn die Quelle gescannt wurde (Negativfall)', () => {
    expect(orphanTwinDocuments({ families: [family], scannedFileIds: new Set(['s1']), scannedFolderIds: new Set(['f1']), rootFolderId: 'root' })).toEqual([])
  })

  it('meldet nichts fuer ein Twin-Dokument ganz ohne Artefakte', () => {
    const leer = { ...family, artifacts: [] }
    expect(orphanTwinDocuments({ families: [leer], scannedFileIds: new Set(), scannedFolderIds: new Set(), rootFolderId: 'root' })).toEqual([])
  })
})

/**
 * Welle W12 — die Gegenrichtung des Verweis-Audits.
 *
 * Beleg: 15 Faelle, in denen MongoDB Quelle und Transkript kennt und der
 * Storage „Datei nicht gefunden" sagt. Der Scan meldete sie als behebbar;
 * erst zwoelf gleichzeitig scheiternde Jobs brachten die Wahrheit.
 */
describe('inventory-gaps — quelle_verschwunden (W12)', () => {
  const gescannt = new Set(['f1'])

  it('meldet die Quelle als verschwunden, wenn ihr eigener Ordner gelesen wurde', () => {
    const gaps = quellenVerschwunden({
      families: [family], scannedFileIds: new Set(), scannedFolderIds: gescannt,
    })
    expect(gaps.map((g) => g.type)).toEqual(['quelle_verschwunden'])
    expect(gaps[0].severity).toBe('error')
    // Kein Job behebt das — deshalb Mensch, nicht KnowledgeScout.
    expect(gaps[0].actor).toBe('mensch')
    expect(gaps[0].folderId).toBe('f1')
  })

  it('schweigt, wenn der Elternordner gar nicht gelesen wurde — dann ist es Unschaerfe, kein Beweis', () => {
    expect(quellenVerschwunden({
      families: [family], scannedFileIds: new Set(), scannedFolderIds: new Set(['anderer']),
    })).toEqual([])
  })

  it('schweigt, wenn die Datei gefunden wurde', () => {
    expect(quellenVerschwunden({
      families: [family], scannedFileIds: new Set(['s1']), scannedFolderIds: gescannt,
    })).toEqual([])
  })

  it('schweigt bei einer Familie ganz ohne Artefakte', () => {
    expect(quellenVerschwunden({
      families: [{ ...family, artifacts: [] }], scannedFileIds: new Set(), scannedFolderIds: gescannt,
    })).toEqual([])
  })

  it('meldet dieselbe Tatsache NICHT zweimal — orphan_twin haelt sich raus', () => {
    const stark = quellenVerschwunden({
      families: [family], scannedFileIds: new Set(), scannedFolderIds: gescannt,
    })
    const schwach = orphanTwinDocuments({
      families: [family], scannedFileIds: new Set(), scannedFolderIds: gescannt, rootFolderId: 'root',
    })
    expect(stark).toHaveLength(1)
    expect(schwach).toEqual([])
  })
})
