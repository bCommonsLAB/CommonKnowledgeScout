/**
 * @fileoverview Routen-Tests: POST /api/library/[libraryId]/agent-view/stand (F8, W7).
 *
 * Geprueft wird der benannte Fehlerkatalog Ende-zu-Ende an der duennen Route:
 * 401/400-Gates, 404 fuer die Library, 409 `nicht_bereit` MIT Befundliste aus
 * dem frischen (gemockten) Teilbaum-Scan, 409 `stand_geaendert` mit
 * `aktuellerStand` — und der Happy-Path, der den neuen Stand zurueckgibt.
 * Clerk, LibraryService, Provider, Report-Repo und Scan sind gemockt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { StorageItem } from '@/lib/storage/types'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getLibrary: vi.fn(),
  getServerProvider: vi.fn(),
  getCoverageReport: vi.fn(),
  scanLibraryCoverage: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: h.getLibrary }) },
}))
vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: h.getServerProvider }))
vi.mock('@/lib/repositories/agent-view-coverage-repo', () => ({ getCoverageReport: h.getCoverageReport }))
vi.mock('@/lib/agent-view/run-coverage-scan', () => ({ scanLibraryCoverage: h.scanLibraryCoverage }))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/library/[libraryId]/agent-view/stand/route'

const INDEX_MD = '---\nbearbeitungsstand: berichtet\nbearbeitungsstand_seit: 2026-08-18\n---\n\n# Pilot\n'

function item(name: string): StorageItem {
  return {
    id: `id-${name}`, parentId: 'f-pilot', type: 'file',
    metadata: { name, size: 10, modifiedAt: new Date('2026-08-20T10:00:00.000Z'), mimeType: 'text/markdown' },
  }
}

function req(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/library/lib-1/agent-view/stand', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}
const params = Promise.resolve({ libraryId: 'lib-1' })

const BODY = { folderId: 'f-pilot', stand: 'abgenommen', erwarteterStand: 'berichtet', reportGeneratedAt: 'G1' }

function allesOk(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'peter@example.com' }] })
  h.getLibrary.mockResolvedValue({ id: 'lib-1' })
  h.getCoverageReport.mockResolvedValue({ generatedAt: 'G1' })
  h.scanLibraryCoverage.mockResolvedValue({ gaps: [] })
  h.getServerProvider.mockResolvedValue({
    listItemsById: vi.fn().mockResolvedValue([item('_INDEX.md')]),
    getBinary: vi.fn().mockResolvedValue({ blob: { text: async () => INDEX_MD } }),
    deleteItem: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue({ id: 'id-neu' }),
  })
}

beforeEach(() => vi.resetAllMocks())

describe('POST /api/library/[libraryId]/agent-view/stand', () => {
  it('401 ohne Auth, 404 ohne Library, 400 bei kaputtem Body', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await POST(req(BODY), { params })).status).toBe(401)

    allesOk()
    h.getLibrary.mockResolvedValue(null)
    expect((await POST(req(BODY), { params })).status).toBe(404)

    allesOk()
    const kaputt = await POST(req({ ...BODY, stand: 'fertig' }), { params })
    expect(kaputt.status).toBe(400)
    expect((await kaputt.json()).code).toBe('invalid_request')
  })

  it('409 nicht_bereit traegt die Befundliste des FRISCHEN Scans — geschrieben wird nichts', async () => {
    allesOk()
    h.scanLibraryCoverage.mockResolvedValue({
      gaps: [{
        type: 'report_missing', actor: 'cowork', zyklusSchritt: 3, severity: 'error', scope: 'folder',
        targetId: 'f-pilot', targetName: 'Pilot', folderId: 'f-pilot', path: '1. Arbeit/Pilot', message: 'Kein BERICHT.md',
      }],
    })
    const antwort = await POST(req(BODY), { params })
    expect(antwort.status).toBe(409)
    const json = await antwort.json()
    expect(json.code).toBe('nicht_bereit')
    expect(json.gesamt).toBe(1)
    expect(json.befunde[0]).toMatchObject({ actor: 'cowork', severity: 'error', path: '1. Arbeit/Pilot' })
    expect(h.scanLibraryCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ libraryId: 'lib-1', folderId: 'f-pilot' }),
    )
    const provider = await h.getServerProvider.mock.results[0].value
    expect(provider.deleteItem).not.toHaveBeenCalled()
  })

  it('409 stand_geaendert nennt den aktuellen Storage-Stand', async () => {
    allesOk()
    const antwort = await POST(req({ ...BODY, erwarteterStand: 'erschlossen' }), { params })
    expect(antwort.status).toBe(409)
    const json = await antwort.json()
    expect(json.code).toBe('stand_geaendert')
    expect(json.aktuellerStand).toBe('berichtet')
  })

  it('Happy-Path: schreibt und antwortet mit dem neu gelesenen Stand', async () => {
    allesOk()
    const antwort = await POST(req(BODY), { params })
    expect(antwort.status).toBe(200)
    const json = await antwort.json()
    expect(json.stand.bearbeitungsstand).toBe('abgenommen')
    expect(typeof json.stand.bearbeitungsstandSeit).toBe('string')
    const provider = await h.getServerProvider.mock.results[0].value
    expect(provider.deleteItem).toHaveBeenCalledWith('id-_INDEX.md')
    expect(provider.uploadFile).toHaveBeenCalledTimes(1)
  })
})
