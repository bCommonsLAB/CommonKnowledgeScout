import { describe, it, expect } from 'vitest'
import { gapsFromSyncReport, gapsFromSyncRow, type SourceLocation } from '@/lib/agent-view/engine-gaps'
import type { LibrarySyncReport, SourceOperationReport, SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'
import type { ReconcileStatus } from '@/lib/shadow-twin/reconcile-plan'

const LOCATIONS = new Map<string, SourceLocation>([['s1', { folderId: 'f1', path: '25.01 Pilot/Aufnahme.m4a' }]])

function op(overrides: Partial<SourceOperationReport>): SourceOperationReport {
  return { type: 'conflict', kind: 'transcript', targetLanguage: '', fileName: 'Aufnahme.md', selected: false, ...overrides }
}

function row(overrides: Partial<SourceSyncReportRow> = {}): SourceSyncReportRow {
  return {
    sourceId: 's1',
    sourceName: 'Aufnahme.m4a',
    transcriptStatus: 'ok' as ReconcileStatus,
    winnerName: 'Aufnahme.md',
    winnerOrigin: 'mongo',
    winnerPages: 1,
    operations: [],
    notes: [],
    ...overrides,
  }
}

describe('engine-gaps', () => {
  it('meldet source_without_twin bei leerem Transkript ohne Adoption (Positivfall)', () => {
    const gaps = gapsFromSyncRow(row({ transcriptStatus: 'empty' }), LOCATIONS, 'root')
    expect(gaps.map((g) => g.type)).toEqual(['source_without_twin'])
    expect(gaps[0].path).toBe('25.01 Pilot/Aufnahme.m4a')
    expect(gaps[0].actor).toBe('knowledgescout')
  })

  it('meldet source_without_twin NICHT, wenn der Spiegel adoptierbare Artefakte traegt', () => {
    const gaps = gapsFromSyncRow(
      row({ transcriptStatus: 'empty', operations: [op({ type: 'adopt-storage-only-source' })] }),
      LOCATIONS,
      'root',
    )
    expect(gaps.map((g) => g.type)).toEqual([])
  })

  it('meldet nichts fuer eine saubere Quelle (Negativfall)', () => {
    expect(gapsFromSyncRow(row(), LOCATIONS, 'root')).toEqual([])
  })

  it('uebersetzt Engine-Operationen in conflict, twin_stale, legacy_twin_name und path_too_long', () => {
    const gaps = gapsFromSyncRow(
      row({
        operations: [
          op({ type: 'conflict', note: 'nicht entscheidbar' }),
          op({ type: 'needs-pipeline' }),
          op({ type: 'legacy-transcript-name' }),
          op({ type: 'path-too-long' }),
          op({ type: 'update-mongo-transcript' }),
        ],
      }),
      LOCATIONS,
      'root',
    )
    expect(gaps.map((g) => g.type)).toEqual(['conflict', 'twin_stale', 'legacy_twin_name', 'path_too_long'])
  })

  it('haengt unbekannte Quellen an die Wurzel statt sie zu verlieren', () => {
    const gaps = gapsFromSyncRow(row({ sourceId: 'unbekannt', transcriptStatus: 'empty' }), LOCATIONS, 'root')
    expect(gaps[0].folderId).toBe('root')
    expect(gaps[0].path).toBe('Aufnahme.m4a')
  })

  it('meldet einen Quell-Fehler als scan_error', () => {
    const gaps = gapsFromSyncRow(row({ error: 'Twin-Ordner nicht lesbar' }), LOCATIONS, 'root')
    expect(gaps.map((g) => g.type)).toContain('scan_error')
  })

  it('weist einen gekappten Engine-Report aus (kein stilles Auslassen)', () => {
    const report = {
      libraryId: 'lib',
      mode: 'check',
      preset: 'repair',
      totalSources: 900,
      skippedWithoutDoc: 0,
      changed: 0,
      conflicts: 0,
      needsPipeline: 0,
      needsReextract: 0,
      planned: {},
      selected: {},
      executed: {},
      failed: {},
      errors: 0,
      sources: [row()],
      sourcesTruncated: true,
    } as unknown as LibrarySyncReport
    const gaps = gapsFromSyncReport({ report, locations: LOCATIONS, rootFolderId: 'root' })
    expect(gaps.map((g) => g.type)).toEqual(['scan_error'])
    expect(gaps[0].detail).toContain('900')
  })
})
