/**
 * Routen-Tests: /api/account/storage-connections (Liste, Anlegen) und
 * /[id] (Aendern, Loeschen). Clerk und Service sind gemockt; die Fehlerklassen
 * sind echt, damit die Status-Abbildung (400/404/409) geprueft wird.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  auth: vi.fn(), currentUser: vi.fn(),
  list: vi.fn(), create: vi.fn(), update: vi.fn(), del: vi.fn(),
}))
vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/storage-connections/connection-service', () => ({
  listStorageConnectionSummaries: h.list, createStorageConnection: h.create,
  updateStorageConnection: h.update, deleteStorageConnection: h.del,
}))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { GET, POST } from '@/app/api/account/storage-connections/route'
import { PATCH, DELETE } from '@/app/api/account/storage-connections/[id]/route'
import { StorageConnectionInUseError, StorageConnectionInputError, StorageConnectionNotFoundError } from '@/lib/storage-connections/errors'

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/account/storage-connections', {
    method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), headers: { 'Content-Type': 'application/json' },
  })
}
const params = Promise.resolve({ id: 'c1' })

function eingeloggt(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'anna@example.com' }] })
}

beforeEach(() => vi.resetAllMocks())

describe('/api/account/storage-connections', () => {
  it('401 ohne Auth', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await GET()).status).toBe(401)
    expect((await POST(req('POST', {}))).status).toBe(401)
  })

  it('GET liefert die Zusammenfassungen der Person', async () => {
    eingeloggt()
    h.list.mockResolvedValue([{ id: 'c1', label: 'Verein', type: 'nextcloud' }])
    const antwort = await GET()
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ connections: [{ id: 'c1', label: 'Verein', type: 'nextcloud' }] })
    expect(h.list).toHaveBeenCalledWith('anna@example.com')
  })

  it('POST 201 mit Zusammenfassung, 400 bei Eingabefehler', async () => {
    eingeloggt()
    h.create.mockResolvedValue({ id: 'c9', label: 'Neu' })
    expect((await POST(req('POST', { label: 'Neu', type: 'nextcloud' }))).status).toBe(201)
    h.create.mockRejectedValue(new StorageConnectionInputError('Nextcloud: App-Passwort fehlt.'))
    const fehler = await POST(req('POST', { label: 'Neu', type: 'nextcloud' }))
    expect(fehler.status).toBe(400)
    expect((await fehler.json()).error).toContain('App-Passwort')
  })

  it('PATCH 404 wenn unbekannt, DELETE 409 wenn in Benutzung', async () => {
    eingeloggt()
    h.update.mockRejectedValue(new StorageConnectionNotFoundError('c1'))
    expect((await PATCH(req('PATCH', { label: 'x', type: 'nextcloud' }), { params })).status).toBe(404)
    h.del.mockRejectedValue(new StorageConnectionInUseError(['Klima']))
    const antwort = await DELETE(req('DELETE'), { params })
    expect(antwort.status).toBe(409)
    expect((await antwort.json()).error).toContain('Klima')
  })

  it('DELETE 200 nach erfolgreichem Loeschen', async () => {
    eingeloggt()
    h.del.mockResolvedValue(undefined)
    const antwort = await DELETE(req('DELETE'), { params })
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ deleted: true })
  })
})
