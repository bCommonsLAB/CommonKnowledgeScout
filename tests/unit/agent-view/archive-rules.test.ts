import { describe, it, expect } from 'vitest'
import {
  checkBerichtVeraltet,
  checkIndexMissing,
  checkReportMissing,
  compileVorhabenPattern,
  evaluateArchiveRules,
  isVorhaben,
} from '@/lib/agent-view/archive-rules'
import type { ArchiveDocEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { Bearbeitungsstand } from '@/lib/agent-view/types'

function doc(name: string, modifiedAt: string | null, meta: Record<string, unknown> = {}): ArchiveDocEntry {
  return { fileId: `${name}-id`, name, path: `25.01 Pilot/${name}`, modifiedAt, meta, body: '' }
}

function folder(overrides: Partial<ArchiveFolderNode> = {}): ArchiveFolderNode {
  return {
    folderId: 'f1',
    name: '25.01 Pilot',
    path: '25.01 Pilot',
    parentFolderId: 'root',
    depth: 1,
    files: [],
    twinFolders: [],
    index: null,
    bericht: null,
    bearbeitungsstand: null,
    bearbeitungsstandSeit: null,
    ...overrides,
  }
}

const CTX = {
  conventions: { vorhabenFolderPattern: null, indexRequiredMaxDepth: null, berichtFreshness: true },
  vorhabenPattern: null,
  newestChangeInSubtree: null,
  isLibraryRoot: false,
}

describe('archive-rules — Vorhaben-Erkennung', () => {
  it('erkennt ein Vorhaben per Selbstdeklaration (kein hartkodiertes Muster)', () => {
    expect(isVorhaben(folder({ bearbeitungsstand: 'berichtet' }), null)).toBe(true)
    expect(isVorhaben(folder(), null)).toBe(false)
  })

  it('erkennt ein Vorhaben per konfiguriertem Muster', () => {
    const pattern = compileVorhabenPattern('^\\d{2}\\.\\d{2} ')
    expect(isVorhaben(folder(), pattern)).toBe(true)
    expect(isVorhaben(folder({ name: 'Sonstiges' }), pattern)).toBe(false)
  })

  it('wirft bei ungueltigem Muster statt still zu ignorieren', () => {
    expect(() => compileVorhabenPattern('([')).toThrow(/vorhabenFolderPattern/)
  })
})

describe('archive-rules — report_missing', () => {
  it('meldet ein Vorhaben ohne BERICHT.md (Positivfall)', () => {
    const gap = checkReportMissing(folder({ bearbeitungsstand: 'strukturiert' }), null)
    expect(gap?.type).toBe('report_missing')
    expect(gap?.actor).toBe('cowork')
    expect(gap?.zyklusSchritt).toBe(3)
  })

  it('meldet nichts, wenn ein BERICHT.md da ist (Negativfall)', () => {
    const gap = checkReportMissing(folder({ bearbeitungsstand: 'berichtet', bericht: doc('BERICHT.md', null) }), null)
    expect(gap).toBeNull()
  })

  it('meldet nichts fuer ungesichtete Ordner (Gap-Budget uebernimmt)', () => {
    expect(checkReportMissing(folder({ bearbeitungsstand: 'ungesichtet' }), null)).toBeNull()
  })

  it('die Bibliotheks-Wurzel braucht keinen BERICHT (Entscheid 2026-08-19)', () => {
    const wurzel = folder({ folderId: 'root', name: '', path: '', parentFolderId: null, depth: 0, bearbeitungsstand: 'strukturiert' })
    expect(checkReportMissing(wurzel, null, true)).toBeNull()
    // Bei Teilbaum-Scans ist die Scan-Wurzel ein normaler Vorhabensordner.
    expect(checkReportMissing(wurzel, null, false)?.type).toBe('report_missing')
  })
})

describe('archive-rules — index_missing', () => {
  it('meldet Strukturebenen bis zur konfigurierten Tiefe (Positivfall)', () => {
    expect(checkIndexMissing(folder({ depth: 1 }), null, 2)?.type).toBe('index_missing')
  })

  it('meldet nichts unterhalb der Tiefe oder mit vorhandenem Index (Negativfall)', () => {
    expect(checkIndexMissing(folder({ depth: 3 }), null, 2)).toBeNull()
    expect(checkIndexMissing(folder({ depth: 1, index: doc('_INDEX.md', null) }), null, 2)).toBeNull()
  })

  it('ist ohne Konfiguration inaktiv (keine hartkodierte Konvention)', () => {
    expect(checkIndexMissing(folder(), null, null)).toBeNull()
  })
})

describe('archive-rules — bericht_veraltet', () => {
  const bericht = doc('BERICHT.md', '2026-08-10T10:00:00.000Z')

  it('meldet einen Bericht, der aelter als die juengste Aenderung ist (Positivfall)', () => {
    const gap = checkBerichtVeraltet(folder({ bericht }), { ...CTX, newestChangeInSubtree: '2026-08-20T10:00:00.000Z' })
    expect(gap?.type).toBe('bericht_veraltet')
  })

  it('meldet nichts, wenn der Bericht juenger ist (Negativfall)', () => {
    const gap = checkBerichtVeraltet(folder({ bericht }), { ...CTX, newestChangeInSubtree: '2026-08-01T10:00:00.000Z' })
    expect(gap).toBeNull()
  })

  it('ist abschaltbar', () => {
    const ctx = { ...CTX, conventions: { ...CTX.conventions, berichtFreshness: false }, newestChangeInSubtree: '2026-08-20T10:00:00.000Z' }
    expect(checkBerichtVeraltet(folder({ bericht }), ctx)).toBeNull()
  })
})

describe('archive-rules — scan_error + Registry-Aufruf', () => {
  it('weist Teilbaum-Fehler aus, statt sie zu verschlucken', () => {
    const gaps = evaluateArchiveRules(folder({ error: 'Ordner nicht lesbar' }), CTX)
    expect(gaps.map((g) => g.type)).toContain('scan_error')
  })

  it('liefert fuer einen sauberen Vorhabensordner keinen Befund', () => {
    const stand: Bearbeitungsstand = 'abgenommen'
    const clean = folder({
      bearbeitungsstand: stand,
      index: doc('_INDEX.md', '2026-08-01T10:00:00.000Z'),
      bericht: doc('BERICHT.md', '2026-08-20T10:00:00.000Z'),
    })
    expect(evaluateArchiveRules(clean, { ...CTX, newestChangeInSubtree: '2026-08-19T10:00:00.000Z' })).toEqual([])
  })
})
