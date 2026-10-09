/**
 * @fileoverview Routen-Tests: /api/user/story-perspektive (09.10.2026).
 *
 * Die Perspektive im Profil der angemeldeten Person: 401 ohne Anmeldung,
 * 400 bei unbekannten Werten (nicht still uebernommen), Speichern und Lesen
 * unter der normalisierten E-Mail. Clerk und Repo sind gemockt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { alsProfilPerspektive } from '@ks/contracts'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getProfilPerspektive: vi.fn(),
  setProfilPerspektive: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/repositories/user-story-perspektive-repo', () => ({
  getProfilPerspektive: h.getProfilPerspektive,
  setProfilPerspektive: h.setProfilPerspektive,
}))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { GET, PUT } from '@/app/api/user/story-perspektive/route'

const GUELTIG = { targetLanguage: 'de', character: ['ecology'], accessPerspective: ['undefined'], socialContext: 'youth', llmModel: 'google/gemini-2.5-flash' }

const put = (body: unknown) =>
  PUT(new NextRequest('http://x/api/user/story-perspektive', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ userId: 'u1' })
  h.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'Person@Example.org' }, emailAddresses: [] })
})

describe('/api/user/story-perspektive', () => {
  it('401 ohne Anmeldung', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await GET()).status).toBe(401)
    expect((await put(GUELTIG)).status).toBe(401)
  })

  it('GET liefert die Perspektive des Profils oder null', async () => {
    h.getProfilPerspektive.mockResolvedValue(null)
    expect(await (await GET()).json()).toEqual({ perspektive: null })
    expect(h.getProfilPerspektive).toHaveBeenCalledWith('person@example.org')
  })

  it('PUT speichert unter der E-Mail', async () => {
    const res = await put(GUELTIG)
    expect(res.status).toBe(200)
    expect(h.setProfilPerspektive).toHaveBeenCalledWith('person@example.org', GUELTIG)
  })

  it('PUT mit unbekanntem Wert oder kaputtem JSON: 400, nichts gespeichert', async () => {
    expect((await put({ ...GUELTIG, character: ['erfunden'] })).status).toBe(400)
    expect((await put('{kaputt')).status).toBe(400)
    expect(h.setProfilPerspektive).not.toHaveBeenCalled()
  })
})

describe('alsProfilPerspektive', () => {
  it('nimmt Gueltiges, meldet Fehlendes', () => {
    expect(alsProfilPerspektive(GUELTIG)).toEqual(GUELTIG)
    expect(alsProfilPerspektive({ ...GUELTIG, llmModel: ' ' })).toEqual({ fehler: 'llmModel fehlt' })
    expect(alsProfilPerspektive({ ...GUELTIG, character: [] })).toMatchObject({ fehler: expect.stringContaining('character') })
    expect(alsProfilPerspektive({ ...GUELTIG, accessPerspective: ['insight', 'community', 'learning', 'sustainability', 'practical_view', 'future_view'] })).toMatchObject({ fehler: expect.stringContaining('1–5') })
    expect(alsProfilPerspektive(null)).toEqual({ fehler: 'Objekt erwartet' })
  })
})
