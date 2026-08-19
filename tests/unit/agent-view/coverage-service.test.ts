import { describe, it, expect } from 'vitest'
import { runCoverageScan, type CoverageScanPorts, type CoverageScanRequest } from '@/lib/agent-view/coverage-service'
import type { ArchiveFolderNode, ArchiveScanResult } from '@/lib/agent-view/archive-types'
import type { RawTwinFamily } from '@/lib/agent-view/coverage-inputs'
import type { LibrarySyncReport, SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'
import type { CoverageConventions } from '@/lib/agent-view/types'
import type { DocumentVerificationResult } from '@/lib/library-verification/types'

const STANDARD = 'standard-konzept'
const NOW = '2026-08-18T12:00:00.000Z'

const CONVENTIONS: CoverageConventions = {
  standardTemplate: STANDARD,
  vorhabenFolderPattern: null,
  indexRequiredMaxDepth: null,
  berichtFreshness: true,
  scanExcludeGlobs: ['temp'],
}

function folders(args: { aufnahmeModifiedAt: string; berichtBody: string }): ArchiveFolderNode[] {
  return [
    {
      // Wurzel deklariert einen Stand (wie Peters Archiv) — sie ist trotzdem
      // KEIN Vorhaben und braucht keinen BERICHT (Entscheid 2026-08-19).
      folderId: 'root', name: '', path: '', parentFolderId: null, depth: 0,
      files: [{ fileId: 'idx-root', name: '_INDEX.md', path: '_INDEX.md', modifiedAt: '2026-08-01T08:00:00.000Z' }],
      twinFolders: [],
      index: {
        fileId: 'idx-root', name: '_INDEX.md', path: '_INDEX.md', modifiedAt: '2026-08-01T08:00:00.000Z',
        meta: { bearbeitungsstand: 'strukturiert' }, body: '',
      },
      bericht: null,
      bearbeitungsstand: 'strukturiert', bearbeitungsstandSeit: null,
    },
    {
      folderId: 'f-pilot', name: '25.01 Pilot', path: '25.01 Pilot', parentFolderId: 'root', depth: 1,
      files: [
        { fileId: 'src-1', name: 'Aufnahme.m4a', path: '25.01 Pilot/Aufnahme.m4a', modifiedAt: args.aufnahmeModifiedAt },
        { fileId: 'idx-1', name: '_INDEX.md', path: '25.01 Pilot/_INDEX.md', modifiedAt: '2026-08-18T09:00:00.000Z' },
        { fileId: 'ber-1', name: 'BERICHT.md', path: '25.01 Pilot/BERICHT.md', modifiedAt: '2026-08-18T10:00:00.000Z' },
      ],
      twinFolders: [{
        folderId: 'twin-1', name: '_Aufnahme.m4a', path: '25.01 Pilot/_Aufnahme.m4a',
        expectedSourceName: 'Aufnahme.m4a', sourcePresent: true, artifactNames: ['Aufnahme.md'],
      }],
      index: {
        fileId: 'idx-1', name: '_INDEX.md', path: '25.01 Pilot/_INDEX.md', modifiedAt: '2026-08-18T09:00:00.000Z',
        meta: { bearbeitungsstand: 'abgenommen', bearbeitungsstand_seit: '2026-08-18' }, body: '',
      },
      bericht: {
        fileId: 'ber-1', name: 'BERICHT.md', path: '25.01 Pilot/BERICHT.md', modifiedAt: '2026-08-18T10:00:00.000Z',
        meta: { type: 'bericht' }, body: args.berichtBody,
      },
      bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: '2026-08-18T23:59:59.999Z',
    },
    {
      folderId: 'f-alt', name: 'Alt', path: 'Alt', parentFolderId: 'root', depth: 1,
      files: [{ fileId: 'src-2', name: 'Rest.pdf', path: 'Alt/Rest.pdf', modifiedAt: '2026-01-01T00:00:00.000Z' }],
      twinFolders: [],
      index: {
        fileId: 'idx-2', name: '_INDEX.md', path: 'Alt/_INDEX.md', modifiedAt: '2026-01-01T00:00:00.000Z',
        meta: { bearbeitungsstand: 'ungesichtet' }, body: '',
      },
      bericht: null,
      bearbeitungsstand: 'ungesichtet', bearbeitungsstandSeit: null,
    },
  ]
}

function syncRow(overrides: Partial<SourceSyncReportRow>): SourceSyncReportRow {
  return {
    sourceId: 'src-1', sourceName: 'Aufnahme.m4a', transcriptStatus: 'ok',
    winnerName: 'Aufnahme.md', winnerOrigin: 'mongo', winnerPages: 1,
    operations: [], notes: [], ...overrides,
  }
}

function syncReport(rows: SourceSyncReportRow[]): LibrarySyncReport {
  return {
    libraryId: 'lib-1', mode: 'check', preset: 'repair',
    totalSources: rows.length, scannedFiles: 4, skippedWithoutDoc: 0, skippedExcluded: 7,
    changed: 0, conflicts: 0, needsPipeline: 0, needsReextract: 0,
    planned: {}, selected: {}, executed: {}, failed: {},
    errors: 0, sources: rows, sourcesTruncated: false,
  }
}

function verifiedFamily(): RawTwinFamily {
  return {
    sourceId: 'src-1', sourceName: 'Aufnahme.m4a', parentId: 'f-pilot',
    artifacts: [
      {
        kind: 'transcript', targetLanguage: '', updatedAt: '2026-08-17T10:00:00.000Z',
        frontmatter: { type: 'transcript', source_file: 'Aufnahme.m4a', generated_by: 'knowledgescout/gemini-2.5-pro', generated_at: '2026-08-17T10:00:00.000Z' },
      },
      {
        kind: 'transformation', templateName: STANDARD, targetLanguage: 'de', updatedAt: '2026-08-17T11:00:00.000Z',
        frontmatter: {
          type: 'transformation', source_file: 'Aufnahme.m4a', template: STANDARD, language: 'de',
          generated_by: 'knowledgescout/gemini-2.5-pro', generated_at: '2026-08-17T11:00:00.000Z',
          verified_by: 'human:peter', verified_at: '2026-08-18',
        },
      },
    ],
  }
}

function makePorts(args: {
  archive: ArchiveScanResult
  report: LibrarySyncReport
  families: RawTwinFamily[]
  fieldDocuments?: DocumentVerificationResult[]
  fieldError?: string
}): CoverageScanPorts {
  return {
    scanArchive: async () => args.archive,
    runSyncCheck: async () => args.report,
    loadTwinFamilies: async () => args.families,
    runFieldVerification: async () => {
      if (args.fieldError) throw new Error(args.fieldError)
      return args.fieldDocuments ?? []
    },
    now: () => NOW,
  }
}

const REQUEST: CoverageScanRequest = {
  libraryId: 'lib-1', rootFolderId: 'root', scopeFolderId: null, conventions: CONVENTIONS,
}

const GRUEN_BERICHT = 'Der Bericht stuetzt sich auf [[Aufnahme.md]] der Quelle Aufnahme.m4a.'

async function scan(overrides: {
  aufnahmeModifiedAt?: string
  berichtBody?: string
  rows?: SourceSyncReportRow[]
  families?: RawTwinFamily[]
  fieldDocuments?: DocumentVerificationResult[]
  fieldError?: string
} = {}) {
  const archive: ArchiveScanResult = {
    folders: folders({
      aufnahmeModifiedAt: overrides.aufnahmeModifiedAt ?? '2026-08-16T10:00:00.000Z',
      berichtBody: overrides.berichtBody ?? GRUEN_BERICHT,
    }),
    skippedExcluded: 3,
  }
  const rows = overrides.rows ?? [syncRow({}), syncRow({ sourceId: 'src-2', sourceName: 'Rest.pdf', transcriptStatus: 'empty' })]
  return runCoverageScan(
    REQUEST,
    makePorts({
      archive,
      report: syncReport(rows),
      families: overrides.families ?? [verifiedFamily()],
      fieldDocuments: overrides.fieldDocuments,
      fieldError: overrides.fieldError,
    }),
  )
}

describe('coverage-service — Komposition', () => {
  it('markiert den Report als abgeleitet und uebernimmt beide Ausschluss-Zaehler', async () => {
    const report = await scan()
    expect(report.derived).toBe(true)
    expect(report.generatedAt).toBe(NOW)
    expect(report.totals.skippedExcluded).toEqual({ archive: 3, engine: 7 })
    expect(report.conventions.standardTemplate).toBe(STANDARD)
  })

  it('zeigt ein abgenommenes Vorhaben ohne Befund durchgehend gruen (Akzeptanzkriterium 7)', async () => {
    const report = await scan()
    const pilot = report.tree[0].children.find((n) => n.folderId === 'f-pilot')
    expect(pilot?.totalGaps).toBe(0)
    expect(pilot?.ampel).toBe('gruen')
    expect(report.vorhaben.find((v) => v.folderId === 'f-pilot')?.widerspruch).toBe(false)
  })

  it('fasst den ungesichteten Teilbaum zu einem Sammel-Gap zusammen (Gap-Budget)', async () => {
    const report = await scan()
    const alt = report.tree[0].children.find((n) => n.folderId === 'f-alt')
    expect(alt?.gapsByType).toEqual({ teilbaum_ungesichtet: 1 })
    expect(report.totals.collapsedGaps).toBe(1)
  })

  it('meldet stand_widerspruch nach einer Aenderung unter einem abgenommenen Vorhaben (Akzeptanzkriterium 8)', async () => {
    const report = await scan({ aufnahmeModifiedAt: '2026-08-20T10:00:00.000Z' })
    const widerspruch = report.gaps.filter((g) => g.type === 'stand_widerspruch')
    expect(widerspruch).toHaveLength(1)
    expect(widerspruch[0].folderId).toBe('f-pilot')
    expect(report.vorhaben.find((v) => v.folderId === 'f-pilot')?.widerspruch).toBe(true)
  })

  it('meldet toten und veralteten Verweis und ist nach der Korrektur sauber (Akzeptanzkriterium 9)', async () => {
    const kaputt = await scan({
      berichtBody: 'Siehe [[Weg.pdf]] sowie [[Aufnahme.md]].',
      families: [
        {
          ...verifiedFamily(),
          artifacts: verifiedFamily().artifacts.map((a) =>
            a.kind === 'transcript' ? { ...a, updatedAt: '2026-08-19T10:00:00.000Z' } : a,
          ),
        },
      ],
    })
    const typen = kaputt.gaps.map((g) => g.type)
    expect(typen).toContain('verweis_tot')
    expect(typen).toContain('verweis_veraltet')

    const korrigiert = await scan()
    expect(korrigiert.gaps.filter((g) => g.type === 'verweis_tot' || g.type === 'verweis_veraltet')).toEqual([])
  })

  it('rekonstruiert aus identischen Eingaben einen identischen Report (Report-Wegwerf-Test, Akzeptanzkriterium 6)', async () => {
    const [erster, zweiter] = [await scan(), await scan()]
    expect(zweiter).toEqual(erster)
    expect(JSON.stringify(zweiter)).toBe(JSON.stringify(erster))
  })

  it('uebersetzt A1-Basisfeld-Befunde in core_fields_missing und isoliert A1-Fehler', async () => {
    const fieldDocuments: DocumentVerificationResult[] = [
      {
        fileId: 'src-1',
        fileName: 'Aufnahme.m4a',
        issues: [
          { code: 'missing-base-field', severity: 'error', field: 'authors', message: 'fehlt', autoFixable: false },
          { code: 'facet-type-mismatch', severity: 'warning', field: 'tags', message: 'anders', autoFixable: false },
        ],
        ok: false,
      },
    ]
    const report = await scan({ fieldDocuments })
    const fieldGaps = report.gaps.filter((g) => g.type === 'core_fields_missing')
    expect(fieldGaps).toHaveLength(1)
    expect(fieldGaps[0].folderId).toBe('f-pilot')
    expect(fieldGaps[0].detail).toBe('authors')

    // A1-Fehler bricht den Scan nicht ab, sondern wird als scan_error sichtbar.
    const kaputt = await scan({ fieldError: 'Mongo nicht erreichbar' })
    const scanErrors = kaputt.gaps.filter((g) => g.type === 'scan_error')
    expect(scanErrors.some((g) => g.detail === 'Mongo nicht erreichbar')).toBe(true)
    expect(kaputt.tree.length).toBeGreaterThan(0)
  })

  it('behandelt die Bibliotheks-Wurzel nicht als Vorhaben — kein BERICHT noetig (Entscheid 2026-08-19)', async () => {
    const report = await scan()
    expect(report.gaps.some((g) => g.type === 'report_missing' && g.folderId === 'root')).toBe(false)
    expect(report.vorhaben.some((v) => v.folderId === 'root')).toBe(false)
    // Der erklaerte Stand der Wurzel bleibt im Baum sichtbar (nur die Pflicht faellt).
    expect(report.tree[0].bearbeitungsstand).toBe('strukturiert')
  })

  it('meldet Quellen, die die Engine still ueberspringt, als source_without_twin (W1-Nachzug)', async () => {
    // Keine Engine-Zeilen, keine Familien: Aufnahme.m4a (f-pilot) und Rest.pdf
    // (f-alt) sind die stille skippedWithoutDoc-Menge des Engine-Laufs.
    const report = await scan({ rows: [], families: [] })
    const quellen = report.gaps.filter((g) => g.type === 'source_without_twin')
    expect(quellen.map((g) => g.targetId)).toEqual(['src-1'])
    expect(quellen[0].folderId).toBe('f-pilot')
    // Rest.pdf liegt im ungesichteten Teilbaum → im Sammel-Gap, kein Einzelbefund.
    const alt = report.tree[0].children.find((n) => n.folderId === 'f-alt')
    expect(alt?.gapsByType.teilbaum_ungesichtet).toBe(1)
    // Markdown-Dateien (_INDEX.md, BERICHT.md) erzeugen KEINE Quellen-Befunde.
    expect(report.gaps.some((g) => g.type === 'source_without_twin' && g.targetName.endsWith('.md'))).toBe(false)
  })

  it('routet Befunde an den zustaendigen Akteur (Todo-Routing F2)', async () => {
    const report = await scan({
      rows: [syncRow({ transcriptStatus: 'empty' })],
      families: [{ ...verifiedFamily(), artifacts: [verifiedFamily().artifacts[0]] }],
    })
    const byType = new Map(report.gaps.map((g) => [g.type, g]))
    expect(byType.get('source_without_twin')?.actor).toBe('knowledgescout')
    expect(byType.get('transformation_missing')?.actor).toBe('knowledgescout')
    expect(byType.get('twin_unverified')?.actor).toBe('mensch')
    expect(report.totals.gapsByActor.knowledgescout).toBeGreaterThan(0)
  })
})
