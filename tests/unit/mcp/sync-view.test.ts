/**
 * @fileoverview Unit-Tests: kompakte Sync-Engine-Sicht der MCP-Bruecke (Welle 5).
 */

import { describe, it, expect } from 'vitest'
import type { LibrarySyncReport, SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'
import { summarizeSyncReport } from '@/lib/mcp/sync-view'

function row(overrides: Partial<SourceSyncReportRow> = {}): SourceSyncReportRow {
  return {
    sourceId: 's1', sourceName: 'A.pdf', transcriptStatus: 'ok',
    winnerName: null, winnerOrigin: null, winnerPages: 0,
    operations: [], notes: [], ...overrides,
  }
}

function engineReport(rows: SourceSyncReportRow[], overrides: Partial<LibrarySyncReport> = {}): LibrarySyncReport {
  return {
    libraryId: 'lib-1', mode: 'check', preset: 'repair',
    totalSources: rows.length, scannedFiles: 10, skippedWithoutDoc: 3, skippedExcluded: 1,
    changed: 0, conflicts: 1, needsPipeline: 0, needsReextract: 0,
    planned: { conflict: 1 }, selected: {}, executed: {}, failed: {},
    errors: 0, sources: rows, sourcesTruncated: false, ...overrides,
  }
}

describe('summarizeSyncReport', () => {
  it('zeigt nur Zeilen mit Substanz (Operationen, Notizen oder Fehler)', () => {
    const view = summarizeSyncReport(
      engineReport([
        row(),
        row({
          sourceId: 's2', sourceName: 'B.pdf',
          operations: [{ type: 'conflict', kind: 'transformation', targetLanguage: 'de', fileName: 'B.standard.de.md', note: 'manuell pruefen', selected: false }],
        }),
        row({ sourceId: 's3', sourceName: 'C.pdf', error: 'Twin-Ordner nicht lesbar' }),
      ]),
    )
    expect(view.zeilenAnzahl).toBe(2)
    expect(view.zeilen.map((z) => z.sourceName)).toEqual(['B.pdf', 'C.pdf'])
    expect(view.zeilen[0].operationen[0]).toMatchObject({ type: 'conflict', imPreset: false, note: 'manuell pruefen' })
    expect(view.zaehler.konflikte).toBe(1)
    expect(view.hinweis).toContain('NICHTS wurde geschrieben')
  })

  it('kappt Detail-Zeilen am Budget und weist das aus', () => {
    const many = Array.from({ length: 5 }, (_, index) =>
      row({ sourceId: `s${index}`, sourceName: `Q${index}.pdf`, notes: ['Hinweis'] }),
    )
    const view = summarizeSyncReport(engineReport(many), { maxRows: 2 })
    expect(view.zeilen).toHaveLength(2)
    expect(view.zeilenAnzahl).toBe(5)
    expect(view.zeilenGekappt).toBe(true)
  })

  it('repair-Modus traegt Ausfuehrungsstatus und den passenden Hinweis', () => {
    const view = summarizeSyncReport(
      engineReport(
        [row({
          operations: [{ type: 'mirror-artifact-to-storage', kind: 'transformation', targetLanguage: 'de', fileName: 'A.standard.de.md', selected: true, executed: true }],
        })],
        { mode: 'repair', preset: 'export', executed: { 'mirror-artifact-to-storage': 1 } },
      ),
    )
    expect(view.hinweis).toContain('Preset')
    expect(view.zeilen[0].operationen[0]).toMatchObject({ imPreset: true, ausgefuehrt: true })
    expect(view.operationen.ausgefuehrt).toEqual({ 'mirror-artifact-to-storage': 1 })
  })
})
