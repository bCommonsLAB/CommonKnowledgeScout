/**
 * @fileoverview Routen-Tests: GET/POST /api/external/jobs/worker (Befund 18.11.2026).
 *
 * Die Middleware verlangt fuer /worker inzwischen eine Session. Die Route prueft
 * zusaetzlich selbst, damit eine spaeter wieder zu weit gefasste Ausnahme den
 * Worker nicht erneut oeffnet. Ausserdem: Unbekannte Aktionen sind ein 400 und
 * werden nicht mehr still zu `start` (no-silent-fallbacks).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  tickNow: vi.fn(),
  getStatus: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/external-jobs-worker', () => ({
  ExternalJobsWorker: {
    start: h.start,
    stop: h.stop,
    tickNow: h.tickNow,
    getStatus: h.getStatus,
    getReaperMaxAgeMs: () => 600_000,
  },
}))
vi.mock('@/lib/external-jobs-repository', () => {
  class ExternalJobsRepository {
    async countRunning() { return 2 }
    async countStaleRunning() { return 0 }
  }
  return { ExternalJobsRepository }
})
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), warn: vi.fn(), info: h.info, debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/external/jobs/worker/route'

function post(body: string): NextRequest {
  return new NextRequest('http://localhost/api/external/jobs/worker', {
    method: 'POST', body, headers: { 'Content-Type': 'application/json' },
  })
}

function angemeldet(): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'Owner@Example.com' } })
}

beforeEach(() => {
  vi.resetAllMocks()
  h.getStatus.mockReturnValue({ state: 'running' })
  h.tickNow.mockResolvedValue(undefined)
})

describe('POST /api/external/jobs/worker', () => {
  it('weist anonym ab und fasst den Worker nicht an', async () => {
    h.auth.mockResolvedValue({ userId: null })
    const res = await POST(post('{"action":"stop"}'))
    expect(res.status).toBe(401)
    expect(h.stop).not.toHaveBeenCalled()
    expect(h.start).not.toHaveBeenCalled()
    expect(h.tickNow).not.toHaveBeenCalled()
  })

  it('weist ohne E-Mail ab (403)', async () => {
    h.auth.mockResolvedValue({ userId: 'user-1' })
    h.currentUser.mockResolvedValue({ emailAddresses: [] })
    const res = await POST(post('{"action":"stop"}'))
    expect(res.status).toBe(403)
    expect(h.stop).not.toHaveBeenCalled()
  })

  it('stoppt angemeldet und schreibt, wer es war', async () => {
    angemeldet()
    const res = await POST(post('{"action":"stop"}'))
    expect(res.status).toBe(200)
    expect(h.stop).toHaveBeenCalledTimes(1)
    expect(h.info).toHaveBeenCalledWith('jobs-worker', 'Worker-Aktion stop', { userEmail: 'owner@example.com' })
  })

  it('startet und tickt angemeldet', async () => {
    angemeldet()
    expect((await POST(post('{"action":"start"}'))).status).toBe(200)
    expect(h.start).toHaveBeenCalledTimes(1)
    const tick = await POST(post('{"action":"tick"}'))
    expect(tick.status).toBe(200)
    expect(h.tickNow).toHaveBeenCalledTimes(1)
    expect(await tick.json()).toMatchObject({ tickTriggered: true })
  })

  it('unbekannte oder fehlende Aktion ist ein 400, kein stiller Start', async () => {
    angemeldet()
    for (const body of ['{"action":"restart"}', '{}', 'kein json']) {
      const res = await POST(post(body))
      expect(res.status, body).toBe(400)
    }
    expect(h.start).not.toHaveBeenCalled()
    expect(h.stop).not.toHaveBeenCalled()
    expect(h.tickNow).not.toHaveBeenCalled()
  })
})

describe('GET /api/external/jobs/worker', () => {
  it('weist anonym ab', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await GET()).status).toBe(401)
  })

  it('liefert angemeldet Status und Pool-Zahlen', async () => {
    angemeldet()
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ state: 'running', pool: { runningInPool: 2, staleRunningInPool: 0 } })
  })
})
