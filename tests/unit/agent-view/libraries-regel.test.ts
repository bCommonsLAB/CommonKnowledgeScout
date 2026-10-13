import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode, ArchiveScanResult } from '@/lib/agent-view/archive-types'
import { runCoverageScan, type CoverageScanPorts, type CoverageScanRequest } from '@/lib/agent-view/coverage-service'
import {
  checkLibraryOhneVorhaben,
  checkLibraryUnbekannt,
  findeLibrary,
  leseLibrariesFeld,
  type LibraryEintrag,
} from '@/lib/agent-view/libraries-regel'
import type { CoverageConventions } from '@/lib/agent-view/types'
import type { LibrarySyncReport } from '@/lib/shadow-twin/sync-engine/report-types'

const ARCHIV: LibraryEintrag = { id: 'lib-archiv', name: 'Archiv Peter' }
const NEUAUFBAU: LibraryEintrag = { id: '72a883a0-d0d9-45be-8c19-6685c0ad8b95', name: 'Dachverband für Soziales – Neuaufbau' }
const KLIMA: LibraryEintrag = { id: 'lib-klima', name: 'Klimamassnahmen' }
const LIBRARIES = [ARCHIV, NEUAUFBAU, KLIMA]

function vorhaben(args: { name: string; libraries?: unknown; mitBericht?: boolean }): ArchiveFolderNode {
  const path = args.name
  const mitBericht = args.mitBericht ?? true
  return {
    folderId: `f-${args.name}`, name: args.name, path, parentFolderId: 'root', depth: 1,
    files: [], twinFolders: [], index: null,
    bericht: mitBericht
      ? {
          fileId: `ber-${args.name}`, name: 'BERICHT.md', path: `${path}/BERICHT.md`, modifiedAt: '2026-10-13T08:00:00.000Z',
          meta: args.libraries === undefined ? { type: 'bericht' } : { type: 'bericht', libraries: args.libraries },
          body: '',
        }
      : null,
    bearbeitungsstand: null, bearbeitungsstandSeit: null,
  }
}

describe('leseLibrariesFeld / findeLibrary', () => {
  it('liest Liste, Einzelwert und Flow-Form als String', () => {
    expect(leseLibrariesFeld({ libraries: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(leseLibrariesFeld({ libraries: 'a' })).toEqual(['a'])
    expect(leseLibrariesFeld({ libraries: '[a, b]' })).toEqual(['a', 'b'])
    expect(leseLibrariesFeld({})).toEqual([])
  })

  it('trifft per Id exakt und per Name ohne Gross-/Kleinschreibung', () => {
    expect(findeLibrary(NEUAUFBAU.id, LIBRARIES)).toBe(NEUAUFBAU)
    expect(findeLibrary('  klimamassnahmen ', LIBRARIES)).toBe(KLIMA)
    expect(findeLibrary('LIB-KLIMA', LIBRARIES)).toBeNull()
    expect(findeLibrary('', LIBRARIES)).toBeNull()
  })
})

describe('checkLibraryOhneVorhaben', () => {
  it('meldet jede eigene Library, die kein Bericht nennt — die Archiv-Library selbst nie', () => {
    const folders = [vorhaben({ name: '24.09 KnowledgeScout', libraries: [NEUAUFBAU.name] })]
    const gaps = checkLibraryOhneVorhaben({ folders, libraries: LIBRARIES, eigeneLibraryId: ARCHIV.id, rootFolderId: 'root' })
    expect(gaps.map((g) => g.targetId)).toEqual([KLIMA.id])
    expect(gaps[0]).toMatchObject({ type: 'library_ohne_vorhaben', scope: 'library', actor: 'cowork', severity: 'info', folderId: 'root', targetName: KLIMA.name })
    expect(gaps[0].detail).toContain(KLIMA.id)
  })

  it('zaehlt Id-Treffer wie Namenstreffer und ist ohne Berichte vollstaendig', () => {
    const folders = [
      vorhaben({ name: 'A', libraries: NEUAUFBAU.id }),
      vorhaben({ name: 'B', libraries: 'klimamassnahmen' }),
      vorhaben({ name: 'C', mitBericht: false }),
    ]
    expect(checkLibraryOhneVorhaben({ folders, libraries: LIBRARIES, eigeneLibraryId: ARCHIV.id, rootFolderId: 'root' })).toEqual([])
    expect(
      checkLibraryOhneVorhaben({ folders: [vorhaben({ name: 'C', mitBericht: false })], libraries: LIBRARIES, eigeneLibraryId: ARCHIV.id, rootFolderId: 'root' })
        .map((g) => g.targetName),
    ).toEqual([NEUAUFBAU.name, KLIMA.name])
  })
})

describe('checkLibraryUnbekannt', () => {
  it('nennt unbekannte Werte je Bericht als EINEN Sammelbefund', () => {
    const folders = [
      vorhaben({ name: 'A', libraries: ['Gibt es nicht', KLIMA.name, 'lib-fremd'] }),
      vorhaben({ name: 'B', libraries: [KLIMA.id] }),
    ]
    const gaps = checkLibraryUnbekannt({ folders, libraries: LIBRARIES })
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ type: 'library_unbekannt', scope: 'folder', folderId: 'f-A', targetName: 'BERICHT.md' })
    expect(gaps[0].message).toContain('2 Wert(e)')
    expect(gaps[0].detail).toBe('„Gibt es nicht", „lib-fremd"')
  })
})

// — Verdrahtung im Scan: Port optional, nur Library-weit —

const CONVENTIONS: CoverageConventions = {
  // `JJ.MM `-Ordner sind Vorhaben — sonst entsteht keine Karte (vorhaben-board).
  standardTemplate: 'standard', vorhabenFolderPattern: '^\\d\\d\\.\\d\\d ', indexRequiredMaxDepth: null,
  berichtFreshness: false, postfachMaxRueckstandWochen: null, repoMaxRueckstandTage: null,
  berichtMaxBytes: { anwendung: null, plattform: null }, statusMaxZeilen: null, ueberholtNachTagen: null,
  themenVokabularGepflegt: false, scanExcludeGlobs: [],
}

function wurzel(): ArchiveFolderNode {
  return {
    folderId: 'root', name: '', path: '', parentFolderId: null, depth: 0,
    files: [], twinFolders: [], index: null, bericht: null, bearbeitungsstand: null, bearbeitungsstandSeit: null,
  }
}

function leererSyncReport(): LibrarySyncReport {
  return {
    libraryId: ARCHIV.id, mode: 'check', preset: 'repair',
    totalSources: 0, scannedFiles: 0, skippedWithoutDoc: 0, skippedExcluded: 0,
    changed: 0, conflicts: 0, needsPipeline: 0, needsReextract: 0,
    planned: {}, selected: {}, executed: {}, failed: {},
    errors: 0, wiederverwendet: 0, gelesen: 0, sources: [], sourcesTruncated: false,
  }
}

function ports(mitLibraries: boolean): CoverageScanPorts {
  const archive: ArchiveScanResult = { folders: [wurzel(), vorhaben({ name: '24.09 KnowledgeScout', libraries: [NEUAUFBAU.name] })], skippedExcluded: 0 }
  return {
    scanArchive: async () => archive,
    runSyncCheck: async () => leererSyncReport(),
    loadTwinFamilies: async () => [],
    runFieldVerification: async () => [],
    ...(mitLibraries ? { listeLibraries: async () => LIBRARIES } : {}),
    now: () => '2026-10-13T12:00:00.000Z',
  }
}

const VOLL: CoverageScanRequest = { libraryId: ARCHIV.id, rootFolderId: 'root', scopeFolderId: null, conventions: CONVENTIONS }

describe('runCoverageScan + listeLibraries', () => {
  it('meldet im Voll-Scan mit Port genau die nicht genannte Library', async () => {
    const report = await runCoverageScan(VOLL, ports(true))
    const befunde = report.gaps.filter((g) => g.type === 'library_ohne_vorhaben')
    expect(befunde.map((g) => g.targetId)).toEqual([KLIMA.id])
    expect(report.vorhaben.find((k) => k.name === '24.09 KnowledgeScout')?.libraries).toEqual([NEUAUFBAU.name])
  })

  it('bleibt ohne Port und im Teilbaum stumm', async () => {
    const ohnePort = await runCoverageScan(VOLL, ports(false))
    expect(ohnePort.gaps.some((g) => g.type === 'library_ohne_vorhaben' || g.type === 'library_unbekannt')).toBe(false)
    const teilbaum = await runCoverageScan({ ...VOLL, rootFolderId: 'f-24.09 KnowledgeScout', scopeFolderId: 'f-24.09 KnowledgeScout' }, ports(true))
    expect(teilbaum.gaps.some((g) => g.type === 'library_ohne_vorhaben' || g.type === 'library_unbekannt')).toBe(false)
  })
})
