/**
 * Routen-Tests der Verwaltungssicht „Fragen & Antworten":
 * GET /api/chat/[libraryId]/queries/admin und POST .../queries/invalidate.
 * Berechtigung (401 ohne Anmeldung, 403 ohne Owner/Moderator, 404 ohne
 * Library), Parameter-Pruefung (400) und der Happy-Path mit gemockter
 * Verwaltungsschicht. Clerk, Members-Repo, LibraryService, Verwaltungs-Repo
 * und Aktualitaets-Pruefer sind gemockt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  isModeratorOrOwner: vi.fn(),
  getLibraryById: vi.fn(),
  listeFragenLogGruppen: vi.fn(),
  zaehleGueltigeAntworten: vi.fn(),
  verwerfeAntworten: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/repositories/library-members-repo', () => ({ isModeratorOrOwner: h.isModeratorOrOwner }))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibraryById: h.getLibraryById }) },
}))
vi.mock('@/lib/db/queries-verwaltung', () => ({
  listeFragenLogGruppen: h.listeFragenLogGruppen,
  zaehleGueltigeAntworten: h.zaehleGueltigeAntworten,
  verwerfeAntworten: h.verwerfeAntworten,
}))
vi.mock('@/lib/chat/utils/cache-aktualitaet', () => ({
  baueAktualitaetsPruefer: () => ({ hinweis: null, pruefe: async () => 'aktuell' }),
}))

import { GET } from '@/app/api/chat/[libraryId]/queries/admin/route'
import { POST } from '@/app/api/chat/[libraryId]/queries/invalidate/route'

const params = Promise.resolve({ libraryId: 'lib-1' })
function get(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/chat/lib-1/queries/admin${query}`)
}
function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chat/lib-1/queries/invalidate', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const GRUPPE = {
  queryId: 'q-1', question: 'Was gilt?', shortTitle: 'Gilt', createdAt: new Date('2026-11-09T10:00:00Z'), status: 'ok',
  cacheHash: 'h1', cacheParams: { libraryId: 'lib-1', question: 'Was gilt?', targetLanguage: 'de', llmModel: 'm', facetsSelected: { jahr: ['2026'] } },
  cacheInvalidatedAt: null, anzahlQuellen: 3, anzahlEintraege: 2,
}

function angemeldetAlsOwner(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'owner@example.com' }] })
  h.isModeratorOrOwner.mockResolvedValue(true)
  h.getLibraryById.mockResolvedValue({ id: 'lib-1', config: { chat: {} } })
  h.listeFragenLogGruppen.mockResolvedValue([GRUPPE])
  h.zaehleGueltigeAntworten.mockResolvedValue(1)
  h.verwerfeAntworten.mockResolvedValue({ verworfen: 2, gefunden: 1, zeitpunkt: new Date('2026-11-09T11:00:00Z') })
}

beforeEach(() => vi.resetAllMocks())

describe('Berechtigung (beide Routen)', () => {
  it('401 ohne Anmeldung', async () => {
    h.auth.mockResolvedValue({ userId: null })
    h.currentUser.mockResolvedValue(null)
    expect((await GET(get(), { params })).status).toBe(401)
    expect((await POST(post({ alle: true }), { params })).status).toBe(401)
  })

  it('403, wenn weder Owner noch Moderator', async () => {
    angemeldetAlsOwner()
    h.isModeratorOrOwner.mockResolvedValue(false)
    expect((await GET(get(), { params })).status).toBe(403)
    expect((await POST(post({ alle: true }), { params })).status).toBe(403)
    expect(h.verwerfeAntworten).not.toHaveBeenCalled()
  })

  it('404, wenn die Library nicht existiert', async () => {
    angemeldetAlsOwner()
    h.getLibraryById.mockResolvedValue(null)
    expect((await GET(get(), { params })).status).toBe(404)
  })
})

describe('GET queries/admin', () => {
  it('liefert Zeilen ohne Antworttext und Erstellerdaten, mit Aktualitaet und gesamtTreffer', async () => {
    angemeldetAlsOwner()
    const res = await GET(get('?suche=gilt&nurTreffer=true'), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ gesamt: 1, seite: 1, proSeite: 25, gesamtTreffer: 1, hinweis: null })
    expect(body.zeilen[0]).toMatchObject({
      queryId: 'q-1', frage: 'Was gilt?', kurztitel: 'Gilt', sprache: 'de', modell: 'm', anzahlQuellen: 3, anzahlEintraege: 2,
      facetten: { jahr: ['2026'] }, cacheInvalidatedAt: null, aktualitaet: 'aktuell',
    })
    expect(body.zeilen[0]).not.toHaveProperty('answer')
    expect(body.zeilen[0]).not.toHaveProperty('userEmail')
    expect(h.listeFragenLogGruppen).toHaveBeenCalledWith({ libraryId: 'lib-1', suche: 'gilt', nurTreffer: true })
  })

  it('400 bei ungueltigen Parametern statt stillem Default', async () => {
    angemeldetAlsOwner()
    expect((await GET(get('?seite=0'), { params })).status).toBe(400)
    expect((await GET(get('?proSeite=500'), { params })).status).toBe(400)
    expect((await GET(get('?nurVeraltete=ja'), { params })).status).toBe(400)
  })
})

describe('POST queries/invalidate', () => {
  it('verwirft die genannten Kennungen und meldet die Zahl', async () => {
    angemeldetAlsOwner()
    const res = await POST(post({ queryIds: ['q-1'] }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ verworfen: 2, gefunden: 1, zeitpunkt: '2026-11-09T11:00:00.000Z' })
    expect(h.verwerfeAntworten).toHaveBeenCalledWith({ libraryId: 'lib-1', queryIds: ['q-1'], alle: undefined })
  })

  it('verwirft alle mit alle: true', async () => {
    angemeldetAlsOwner()
    expect((await POST(post({ alle: true }), { params })).status).toBe(200)
    expect(h.verwerfeAntworten).toHaveBeenCalledWith({ libraryId: 'lib-1', queryIds: undefined, alle: true })
  })

  it('400 ohne Auftrag, bei beidem zugleich und bei kaputtem JSON', async () => {
    angemeldetAlsOwner()
    expect((await POST(post({}), { params })).status).toBe(400)
    expect((await POST(post({ queryIds: ['q-1'], alle: true }), { params })).status).toBe(400)
    expect((await POST(post({ alle: false }), { params })).status).toBe(400)
    expect((await POST(post('nicht json'), { params })).status).toBe(400)
    expect(h.verwerfeAntworten).not.toHaveBeenCalled()
  })
})
