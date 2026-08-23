/**
 * @fileoverview Routen-Tests: GET /api/library/[libraryId]/agent-view/bericht (F9, W2).
 *
 * Geprueft wird die §F9-Semantik Ende-zu-Ende an der duennen Route:
 * 401/400-Gates, 404 fuer Library UND Ordner, 200 mit `kein_bericht`,
 * 200 mit `zu_gross`, Happy-Path mit serverseitigem `kopf` — und dass
 * andere Storage-Fehler NICHT als 404 verkleidet werden. Clerk,
 * LibraryService, Server-Provider und Logger sind vollstaendig gemockt
 * (kein Mongo/Storage im Test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { MAX_DOC_BYTES } from '@/lib/agent-view/archive-scan-readers'
import { StorageError, type StorageItem } from '@/lib/storage/types'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getLibrary: vi.fn(),
  getServerProvider: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: h.getLibrary }) },
}))
vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: h.getServerProvider }))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/library/[libraryId]/agent-view/bericht/route'

function req(query = '?folderId=f-1'): NextRequest {
  return new NextRequest(`http://localhost/api/library/lib-1/agent-view/bericht${query}`)
}
const params = Promise.resolve({ libraryId: 'lib-1' })

function item(name: string, size = 100): StorageItem {
  return {
    id: `id-${name}`,
    parentId: 'f-1',
    type: 'file',
    metadata: { name, size, modifiedAt: new Date('2026-08-21T07:30:00.000Z'), mimeType: 'text/markdown' },
  }
}

function authOk(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'peter@example.com' }] })
  h.getLibrary.mockResolvedValue({ id: 'lib-1' })
}

function providerMit(items: StorageItem[] | Error, text = ''): { getBinary: ReturnType<typeof vi.fn> } {
  const listItemsById =
    items instanceof Error ? vi.fn().mockRejectedValue(items) : vi.fn().mockResolvedValue(items)
  const getBinary = vi.fn().mockResolvedValue({ blob: { text: async () => text } })
  h.getServerProvider.mockResolvedValue({ listItemsById, getBinary })
  return { getBinary }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/library/[libraryId]/agent-view/bericht', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await GET(req(), { params })).status).toBe(401)
  })

  it('400 ohne folderId', async () => {
    authOk()
    const res = await GET(req(''), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('folderId')
  })

  it('404 fuer unbekannte Library', async () => {
    authOk()
    h.getLibrary.mockResolvedValue(null)
    expect((await GET(req(), { params })).status).toBe(404)
  })

  it('404 fuer unbekannten Ordner (Provider-Not-Found wird typisiert gemappt)', async () => {
    authOk()
    providerMit(new StorageError('weg', 'NOT_FOUND', 'onedrive'))
    const res = await GET(req('?folderId=f-weg'), { params })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Ordner nicht gefunden')
  })

  it('200 mit kein_bericht — legitimer Domaenenzustand, kein Fehler', async () => {
    authOk()
    providerMit([item('_INDEX.md')])
    const res = await GET(req(), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ bericht: null, grund: 'kein_bericht' })
  })

  it('200 mit zu_gross — Metadaten ohne Body, Datei wird nicht geladen', async () => {
    authOk()
    const provider = providerMit([item('BERICHT.md', MAX_DOC_BYTES + 1)])
    const res = await GET(req(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.grund).toBe('zu_gross')
    expect(json.bericht).toMatchObject({ fileId: 'id-BERICHT.md', body: null, kopf: null })
    expect(provider.getBinary).not.toHaveBeenCalled()
  })

  it('200 Happy-Path: Body ohne Frontmatter plus serverseitiger kopf', async () => {
    authOk()
    providerMit([item('BERICHT.md')], '---\nstatus: aktiv\n---\n# Pilot\n\nWorum es geht.\n')
    const res = await GET(req(), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.grund).toBeUndefined()
    expect(json.bericht.kopf).toEqual({ titel: 'Pilot', ersterAbsatz: 'Worum es geht.', offenePunkte: [] })
    expect(json.bericht.body).not.toContain('status: aktiv')
  })

  it('500 bei anderem Storage-Fehler — Auth-Probleme werden NICHT als 404 verkleidet', async () => {
    authOk()
    providerMit(new StorageError('Token abgelaufen', 'AUTH_ERROR', 'onedrive'))
    expect((await GET(req(), { params })).status).toBe(500)
  })
})
