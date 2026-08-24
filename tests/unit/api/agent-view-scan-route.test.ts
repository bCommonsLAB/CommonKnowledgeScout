/**
 * @fileoverview Routen-Tests: POST /api/library/[libraryId]/agent-view/scan (W8).
 *
 * Seit W8 merged ein Teilbaum-Scan in den gespeicherten Voll-Report statt ihn
 * zu ersetzen. Geprueft wird die Verdrahtung an der duennen Route: Voll-Scan
 * unveraendert, Merge-Erfolg speichert den GEMERGTEN Report, benannte
 * Fallbacks (Merge-Grund, kein gespeicherter Report, gekappte Befundliste)
 * speichern den Teil-Report und sagen warum. Scan, Merge und Repo sind
 * gemockt — die Merge-Logik selbst beweist `report-merge.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  scanLibraryCoverage: vi.fn(),
  getCoverageReport: vi.fn(),
  saveCoverageReport: vi.fn(),
  mergeTeilbaumReport: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/agent-view/run-coverage-scan', () => ({ scanLibraryCoverage: h.scanLibraryCoverage }))
vi.mock('@/lib/repositories/agent-view-coverage-repo', () => ({
  getCoverageReport: h.getCoverageReport,
  saveCoverageReport: h.saveCoverageReport,
}))
vi.mock('@/lib/agent-view/report-merge', () => ({ mergeTeilbaumReport: h.mergeTeilbaumReport }))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/library/[libraryId]/agent-view/scan/route'

const SCAN = { libraryId: 'lib-1', marker: 'frischer-scan' }
const GEMERGT = { libraryId: 'lib-1', marker: 'gemergt' }

function req(body: unknown = {}): NextRequest {
  return new NextRequest('http://localhost/api/library/lib-1/agent-view/scan', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
}
const params = Promise.resolve({ libraryId: 'lib-1' })

function allesOk(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'peter@example.com' }] })
  h.scanLibraryCoverage.mockResolvedValue(SCAN)
  h.getCoverageReport.mockResolvedValue({ report: { marker: 'gespeichert' }, gapsTruncated: false })
  h.saveCoverageReport.mockImplementation(async (report: unknown) => ({
    report, generatedAt: 'T1', gapsTruncated: false, totalGaps: 0,
  }))
  h.mergeTeilbaumReport.mockReturnValue({ merged: true, report: GEMERGT })
}

beforeEach(() => vi.resetAllMocks())

describe('POST /api/library/[libraryId]/agent-view/scan', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await POST(req(), { params })).status).toBe(401)
  })

  it('Voll-Scan speichert den Scan-Report direkt — kein Merge im Spiel', async () => {
    allesOk()
    const antwort = await POST(req({}), { params })
    expect(antwort.status).toBe(200)
    const json = await antwort.json()
    expect(h.getCoverageReport).not.toHaveBeenCalled()
    expect(h.mergeTeilbaumReport).not.toHaveBeenCalled()
    expect(h.saveCoverageReport).toHaveBeenCalledWith(SCAN)
    expect(json.merged).toBe(false)
    expect(json.mergeHinweis).toBeNull()
  })

  it('Teilbaum-Scan merged in den gespeicherten Voll-Report und speichert das Ergebnis', async () => {
    allesOk()
    const antwort = await POST(req({ scope: { folderId: 'f-pilot' } }), { params })
    const json = await antwort.json()
    expect(h.mergeTeilbaumReport).toHaveBeenCalledWith({ voll: { marker: 'gespeichert' }, teil: SCAN })
    expect(h.saveCoverageReport).toHaveBeenCalledWith(GEMERGT)
    expect(json.merged).toBe(true)
    expect(json.mergeHinweis).toBeNull()
  })

  it('benannter Merge-Fallback speichert den Teil-Report und nennt den Grund', async () => {
    allesOk()
    h.mergeTeilbaumReport.mockReturnValue({
      merged: false, grund: 'report_vor_w8', erklaerung: 'Der gespeicherte Report stammt von vor W8',
    })
    const antwort = await POST(req({ scope: { folderId: 'f-pilot' } }), { params })
    const json = await antwort.json()
    expect(h.saveCoverageReport).toHaveBeenCalledWith(SCAN)
    expect(json.merged).toBe(false)
    expect(json.mergeHinweis).toMatch(/vor W8/)
  })

  it('ohne gespeicherten Report wird der Teil-Report direkt gespeichert — benannt', async () => {
    allesOk()
    h.getCoverageReport.mockResolvedValue(null)
    const json = await (await POST(req({ scope: { folderId: 'f-pilot' } }), { params })).json()
    expect(h.mergeTeilbaumReport).not.toHaveBeenCalled()
    expect(json.mergeHinweis).toMatch(/Kein gespeicherter Report/)
  })

  it('gekappte gespeicherte Befundliste verhindert den Merge — benannt, kein Raten', async () => {
    allesOk()
    h.getCoverageReport.mockResolvedValue({ report: { marker: 'gespeichert' }, gapsTruncated: true })
    const json = await (await POST(req({ scope: { folderId: 'f-pilot' } }), { params })).json()
    expect(h.mergeTeilbaumReport).not.toHaveBeenCalled()
    expect(h.saveCoverageReport).toHaveBeenCalledWith(SCAN)
    expect(json.mergeHinweis).toMatch(/gekappt/)
  })
})
