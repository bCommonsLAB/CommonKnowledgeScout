/**
 * @fileoverview Tests: scannen + mergen + speichern — der EINE Weg.
 *
 * Deckt den Live-Befund vom 24.08.2026 ab: Ein Teilbaum-Scan darf den
 * gespeicherten Voll-Report NICHT ersetzen, solange der Merge beweisbar ist.
 * Voll-Scan, Merge-Erfolg und die drei benannten Ersatz-Lagen (kein Report,
 * gekappte Liste, Merge-Fallback) — Scan, Repo und Merge sind gemockt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  scan: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  merge: vi.fn(),
}))

vi.mock('@/lib/agent-view/run-coverage-scan', () => ({ scanLibraryCoverage: h.scan }))
vi.mock('@/lib/agent-view/report-merge', () => ({ mergeTeilbaumReport: h.merge }))
vi.mock('@/lib/repositories/agent-view-coverage-repo', () => ({
  getCoverageReport: h.get,
  saveCoverageReport: h.save,
}))

import { scanneUndSpeichere } from '@/lib/agent-view/scan-speichern'

const TEIL = { marke: 'teil' } as never
const VOLL = { marke: 'voll' } as never
const GEMERGT = { marke: 'gemergt' } as never

beforeEach(() => {
  vi.clearAllMocks()
  h.scan.mockResolvedValue(TEIL)
  h.save.mockImplementation(async (report: unknown) => ({
    report, generatedAt: 'T1', gapsTruncated: false, totalGaps: 0,
  }))
})

describe('scanneUndSpeichere', () => {
  it('Voll-Scan speichert direkt und liest den alten Report gar nicht', async () => {
    const ergebnis = await scanneUndSpeichere({ libraryId: 'L', userEmail: 'a@b.c', folderId: null })

    expect(h.get).not.toHaveBeenCalled()
    expect(h.merge).not.toHaveBeenCalled()
    expect(h.save).toHaveBeenCalledWith(TEIL)
    expect(ergebnis.merged).toBe(false)
    expect(ergebnis.mergeHinweis).toBeNull()
  })

  it('Teilbaum-Scan MERGED in den gespeicherten Voll-Report', async () => {
    h.get.mockResolvedValue({ report: VOLL, gapsTruncated: false })
    h.merge.mockReturnValue({ merged: true, report: GEMERGT })

    const ergebnis = await scanneUndSpeichere({ libraryId: 'L', userEmail: 'a@b.c', folderId: 'F' })

    expect(h.merge).toHaveBeenCalledWith({ voll: VOLL, teil: TEIL })
    expect(h.save).toHaveBeenCalledWith(GEMERGT)
    expect(ergebnis.merged).toBe(true)
    expect(ergebnis.mergeHinweis).toBeNull()
  })

  it('ohne gespeicherten Report wird ersetzt — benannt, nicht still', async () => {
    h.get.mockResolvedValue(null)

    const ergebnis = await scanneUndSpeichere({ libraryId: 'L', userEmail: 'a@b.c', folderId: 'F' })

    expect(h.merge).not.toHaveBeenCalled()
    expect(h.save).toHaveBeenCalledWith(TEIL)
    expect(ergebnis.merged).toBe(false)
    expect(ergebnis.mergeHinweis).toContain('Kein gespeicherter Report')
  })

  it('gekappte Befundliste ist nicht mergebar — benannt', async () => {
    h.get.mockResolvedValue({ report: VOLL, gapsTruncated: true })

    const ergebnis = await scanneUndSpeichere({ libraryId: 'L', userEmail: 'a@b.c', folderId: 'F' })

    expect(h.merge).not.toHaveBeenCalled()
    expect(h.save).toHaveBeenCalledWith(TEIL)
    expect(ergebnis.mergeHinweis).toContain('gekappt')
  })

  it('Merge-Fallback reicht die Erklaerung der Guards durch', async () => {
    h.get.mockResolvedValue({ report: VOLL, gapsTruncated: false })
    h.merge.mockReturnValue({ merged: false, grund: 'report_vor_w8', erklaerung: 'Report von vor W8 — einmal voll scannen.' })

    const ergebnis = await scanneUndSpeichere({ libraryId: 'L', userEmail: 'a@b.c', folderId: 'F' })

    expect(h.save).toHaveBeenCalledWith(TEIL)
    expect(ergebnis.merged).toBe(false)
    expect(ergebnis.mergeHinweis).toBe('Report von vor W8 — einmal voll scannen.')
  })

  it('reicht den Scope-Pfad an den Scan durch (pfad-Aufruf der Bruecke)', async () => {
    h.get.mockResolvedValue(null)

    await scanneUndSpeichere({ libraryId: 'L', userEmail: 'a@b.c', folderId: 'F', scopePath: '4. Oeko/26.01 X' })

    expect(h.scan).toHaveBeenCalledWith({
      libraryId: 'L', userEmail: 'a@b.c', folderId: 'F', scopePath: '4. Oeko/26.01 X',
    })
  })
})
