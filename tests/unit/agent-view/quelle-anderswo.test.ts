import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { RawTwinFamily } from '@/lib/agent-view/coverage-inputs'
import { runCoverageScan, type CoverageScanPorts, type CoverageScanRequest } from '@/lib/agent-view/coverage-service'
import { ergaenzeMoeglicherweiseIn, verschwundeneMitOrten } from '@/lib/agent-view/quelle-anderswo'
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageConventions } from '@/lib/agent-view/types'
import type { OrteJeQuelle } from '@/lib/shadow-twin/quelle-suche'
import type { LibrarySyncReport } from '@/lib/shadow-twin/sync-engine/report-types'

const ORT = { libraryId: 'neu', libraryName: 'Neuaufbau', bibliothek: '@dv-neu', sourceId: 'n1', sourceName: 'Teil 2.m4a', uebereinstimmung: 'name' as const }

function verschwunden(sourceId: string) {
  return createGap({
    type: 'quelle_verschwunden', scope: 'source', targetId: sourceId, targetName: 'Teil 2.m4a',
    folderId: 'f', path: 'Ordner/Teil 2.m4a', message: 'weg', detail: '1 Artefakt(e) in MongoDB',
  })
}

describe('ergaenzeMoeglicherweiseIn', () => {
  it('haengt Orte an, setzt [] fuer gesucht-aber-nichts und laesst andere Befunde in Ruhe', () => {
    const anderer = createGap({ type: 'datei_ohne_endung', scope: 'folder', targetId: 'x', targetName: 'x', folderId: 'f', path: 'x', message: 'm' })
    const orte = new Map<string, OrteJeQuelle>([['s1', { orte: [ORT], gesamt: 7 }]])
    const [eins, zwei, drei] = ergaenzeMoeglicherweiseIn([verschwunden('s1'), verschwunden('s2'), anderer], orte)
    expect(eins.moeglicherweiseIn).toEqual([ORT])
    expect(eins.moeglicherweiseInGesamt).toBe(7)
    expect(eins.detail).toContain('womoeglich in: Neuaufbau (@dv-neu) [name] (+6)')
    expect(zwei.moeglicherweiseIn).toEqual([])
    expect(zwei.detail).toBe('1 Artefakt(e) in MongoDB')
    expect(drei).toBe(anderer)
  })
})

describe('verschwundeneMitOrten', () => {
  it('fragt ohne Port nicht und laesst das Feld weg (nicht gesucht)', async () => {
    const gaps = await verschwundeneMitOrten({ gaps: [verschwunden('s1')], families: [], suche: undefined, rootFolderId: 'root' })
    expect(gaps[0].moeglicherweiseIn).toBeUndefined()
  })

  it('meldet eine gescheiterte Suche als scan_error statt sie zu verschlucken', async () => {
    const gaps = await verschwundeneMitOrten({
      gaps: [verschwunden('s1')], families: [], rootFolderId: 'root',
      suche: async () => { throw new Error('Mongo weg') },
    })
    expect(gaps.map((g) => g.type)).toEqual(['quelle_verschwunden', 'scan_error'])
    expect(gaps[1].detail).toBe('Mongo weg')
  })
})

// — Im Scan: Familie mit Artefakt, Elternordner gelesen, Datei fehlt —

const CONVENTIONS: CoverageConventions = {
  standardTemplate: 'standard', vorhabenFolderPattern: null, indexRequiredMaxDepth: null,
  berichtFreshness: false, postfachMaxRueckstandWochen: null, repoMaxRueckstandTage: null,
  berichtMaxBytes: { anwendung: null, plattform: null }, statusMaxZeilen: null, ueberholtNachTagen: null,
  themenVokabularGepflegt: false, scanExcludeGlobs: [],
}

function ordner(folderId: string, name: string, parentFolderId: string | null): ArchiveFolderNode {
  return {
    folderId, name, path: name, parentFolderId, depth: parentFolderId === null ? 0 : 1,
    files: [], twinFolders: [], index: null, bericht: null, bearbeitungsstand: null, bearbeitungsstandSeit: null,
  }
}

function ports(suche?: CoverageScanPorts['sucheQuelleAnderswo']): CoverageScanPorts {
  const familie: RawTwinFamily = {
    sourceId: 'a1', sourceName: 'Teil 2.m4a', parentId: 'f-ev', sourceContentHash: null, sourceSize: null,
    artifacts: [{ kind: 'transcript', targetLanguage: '', updatedAt: '2026-09-26T00:00:00.000Z', frontmatter: {} }],
  }
  const leer: LibrarySyncReport = {
    libraryId: 'archiv', mode: 'check', preset: 'repair', totalSources: 0, scannedFiles: 0, skippedWithoutDoc: 0, skippedExcluded: 0,
    changed: 0, conflicts: 0, needsPipeline: 0, needsReextract: 0, planned: {}, selected: {}, executed: {}, failed: {},
    errors: 0, wiederverwendet: 0, gelesen: 0, sources: [], sourcesTruncated: false,
  }
  return {
    scanArchive: async () => ({
      folders: [ordner('root', '', null), ordner('f-ev', 'Ereignis', 'root')],
      skippedExcluded: 0,
    }),
    runSyncCheck: async () => leer,
    loadTwinFamilies: async () => [familie],
    runFieldVerification: async () => [],
    ...(suche ? { sucheQuelleAnderswo: suche } : {}),
    now: () => '2026-10-13T12:00:00.000Z',
  }
}

const REQUEST: CoverageScanRequest = { libraryId: 'archiv', rootFolderId: 'root', scopeFolderId: null, conventions: CONVENTIONS }

describe('runCoverageScan + sucheQuelleAnderswo', () => {
  it('traegt die Orte am Befund quelle_verschwunden', async () => {
    let gefragt: unknown = null
    const report = await runCoverageScan(REQUEST, ports(async (quellen) => {
      gefragt = quellen
      return new Map([['a1', { orte: [ORT], gesamt: 1 }]])
    }))
    const gap = report.gaps.find((g) => g.type === 'quelle_verschwunden')
    expect(gap?.moeglicherweiseIn).toEqual([ORT])
    expect(gefragt).toEqual([{ sourceId: 'a1', sourceName: 'Teil 2.m4a', sourceContentHash: null, sourceSize: null }])
  })

  it('ohne Port bleibt der Befund wie vor 2.50.0', async () => {
    const report = await runCoverageScan(REQUEST, ports())
    const gap = report.gaps.find((g) => g.type === 'quelle_verschwunden')
    expect(gap).toBeDefined()
    expect(gap?.moeglicherweiseIn).toBeUndefined()
  })
})
