/**
 * @fileoverview Routen-Tests: Arbeitslisten (F7, Welle W6).
 *
 * Der volle benannte Fehlerkatalog an beiden Routen: 401/400/404-Gates,
 * 201-Anlage (Seeding-Mitglieder bekommen addedAt), 409 `name_vergeben` mit
 * Code im Body, PATCH mit GENAU einer Operation (name/add/remove) inkl.
 * Idempotenz-Durchreichung (`unchanged`), DELETE mit 404. Clerk,
 * LibraryService und das Repo sind vollstaendig gemockt — kein Mongo im Test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  class WorklistNameVergebenError extends Error {
    readonly code = 'name_vergeben' as const
  }
  return {
    auth: vi.fn(),
    currentUser: vi.fn(),
    getLibrary: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    del: vi.fn(),
    NameVergeben: WorklistNameVergebenError,
  }
})

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: h.getLibrary }) },
}))
vi.mock('@/lib/repositories/agent-view-worklists-repo', () => ({
  listWorklists: h.list,
  createWorklist: h.create,
  renameWorklist: h.rename,
  addFolderToWorklist: h.add,
  removeFolderFromWorklist: h.remove,
  deleteWorklist: h.del,
  WorklistNameVergebenError: h.NameVergeben,
}))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/library/[libraryId]/agent-view/worklists/route'
import { PATCH, DELETE } from '@/app/api/library/[libraryId]/agent-view/worklists/[listId]/route'

const params = Promise.resolve({ libraryId: 'lib-1' })
const listParams = Promise.resolve({ libraryId: 'lib-1', listId: 'l-1' })

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/library/lib-1/agent-view/worklists', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  })
}

function authOk(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'peter@example.com' }] })
  h.getLibrary.mockResolvedValue({ id: 'lib-1' })
}

const liste = { listId: 'l-1', name: 'Aktuelle Projekte', position: 0, folders: [] }

beforeEach(() => vi.resetAllMocks())

describe('GET/POST /agent-view/worklists', () => {
  it('401 ohne Auth, 404 fuer unbekannte Library', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await GET(req('GET'), { params })).status).toBe(401)
    authOk()
    h.getLibrary.mockResolvedValue(null)
    expect((await GET(req('GET'), { params })).status).toBe(404)
  })

  it('GET liefert die Listen des Users', async () => {
    authOk()
    h.list.mockResolvedValue([liste])
    const res = await GET(req('GET'), { params })
    expect(res.status).toBe(200)
    expect((await res.json()).lists).toHaveLength(1)
    expect(h.list).toHaveBeenCalledWith('lib-1', 'peter@example.com')
  })

  it('POST legt an (201); Seeding-Mitglieder bekommen addedAt; leerer Name ist 400', async () => {
    authOk()
    h.create.mockResolvedValue(liste)
    const res = await POST(
      req('POST', { name: 'Aktuelle Projekte', folders: [{ folderId: 'f-1', pathSnapshot: 'A/P', name: 'P' }] }),
      { params },
    )
    expect(res.status).toBe(201)
    const uebergeben = h.create.mock.calls[0][3] as Array<{ addedAt?: string }>
    expect(uebergeben[0].addedAt).toBeTruthy()

    expect((await POST(req('POST', { name: '  ' }), { params })).status).toBe(400)
    expect((await POST(req('POST', { name: 'X', folders: [{ kaputt: true }] }), { params })).status).toBe(400)
  })

  it('POST meldet Namensduplikate als 409 name_vergeben', async () => {
    authOk()
    h.create.mockRejectedValue(new h.NameVergeben('Listenname bereits vergeben: X'))
    const res = await POST(req('POST', { name: 'X' }), { params })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('name_vergeben')
  })
})

describe('PATCH/DELETE /agent-view/worklists/[listId]', () => {
  it('verlangt GENAU eine Operation pro Aufruf', async () => {
    authOk()
    expect((await PATCH(req('PATCH', {}), { params: listParams })).status).toBe(400)
    expect((await PATCH(req('PATCH', { name: 'A', remove: 'f-1' }), { params: listParams })).status).toBe(400)
  })

  it('rename: 200 · 404 unbekannte Liste · 409 name_vergeben', async () => {
    authOk()
    h.rename.mockResolvedValue({ ...liste, name: 'Neu' })
    expect((await PATCH(req('PATCH', { name: 'Neu' }), { params: listParams })).status).toBe(200)
    h.rename.mockResolvedValue(null)
    expect((await PATCH(req('PATCH', { name: 'Neu' }), { params: listParams })).status).toBe(404)
    h.rename.mockRejectedValue(new h.NameVergeben('vergeben'))
    expect((await PATCH(req('PATCH', { name: 'Neu' }), { params: listParams })).status).toBe(409)
  })

  it('add reicht die Idempotenz durch (unchanged: true beim Doppel-Hinzufuegen)', async () => {
    authOk()
    h.add.mockResolvedValue({ list: liste, unchanged: true })
    const res = await PATCH(
      req('PATCH', { add: { folderId: 'f-1', pathSnapshot: 'A/P', name: 'P' } }),
      { params: listParams },
    )
    expect(res.status).toBe(200)
    expect((await res.json()).unchanged).toBe(true)
    expect((await PATCH(req('PATCH', { add: { folderId: '' } }), { params: listParams })).status).toBe(400)
  })

  it('remove: 200 mit unchanged · 404 unbekannte Liste', async () => {
    authOk()
    h.remove.mockResolvedValue({ list: liste, unchanged: false })
    expect((await PATCH(req('PATCH', { remove: 'f-1' }), { params: listParams })).status).toBe(200)
    h.remove.mockResolvedValue(null)
    expect((await PATCH(req('PATCH', { remove: 'f-1' }), { params: listParams })).status).toBe(404)
  })

  it('DELETE: 200 {deleted} · 404 unbekannte Liste', async () => {
    authOk()
    h.del.mockResolvedValue(true)
    const res = await DELETE(req('DELETE'), { params: listParams })
    expect(res.status).toBe(200)
    expect((await res.json()).deleted).toBe(true)
    h.del.mockResolvedValue(false)
    expect((await DELETE(req('DELETE'), { params: listParams })).status).toBe(404)
  })
})
